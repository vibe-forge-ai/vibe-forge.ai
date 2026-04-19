import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, resolve } from 'node:path'
import process from 'node:process'

import {
  PROJECT_LAUNCH_CWD_ENV,
  PROJECT_WORKSPACE_FOLDER_ENV,
  resolveProjectAiBaseDir,
  resolveProjectLaunchCwd,
  resolveProjectWorkspaceFolder
} from './ai-path'

export const PROJECT_PRIMARY_WORKSPACE_FOLDER_ENV = '__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__'
export const PROJECT_AI_CACHE_DIR_ENV = '__VF_PROJECT_AI_CACHE_DIR__'

const normalizeDirPath = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  if (trimmed == null || trimmed === '') return undefined
  return trimmed.replace(/[\\/]+$/, '')
}

const resolvePathFromBase = (
  baseDir: string,
  value: string | null | undefined
) => {
  const normalizedValue = normalizeDirPath(value)
  if (normalizedValue == null) {
    return undefined
  }

  if (isAbsolute(normalizedValue)) {
    return resolve(normalizedValue)
  }

  return resolve(baseDir, normalizedValue)
}

const resolveGitPrimaryWorkspaceFolder = (cwd: string) => {
  const result = spawnSync('git', ['rev-parse', '--git-common-dir'], {
    cwd,
    encoding: 'utf8'
  })
  if (result.status !== 0) return undefined

  const gitCommonDir = result.stdout?.trim()
  if (gitCommonDir == null || gitCommonDir === '') return undefined

  const workspaceFolder = resolve(cwd)
  const primaryWorkspaceFolder = dirname(resolve(cwd, gitCommonDir))
  return primaryWorkspaceFolder === workspaceFolder ? undefined : primaryWorkspaceFolder
}

export const resolveProjectPrimaryWorkspaceFolder = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => {
  const explicitPrimaryWorkspaceFolder = resolvePathFromBase(
    resolveProjectLaunchCwd(cwd, env),
    env[PROJECT_PRIMARY_WORKSPACE_FOLDER_ENV]
  )
  if (explicitPrimaryWorkspaceFolder != null) {
    return explicitPrimaryWorkspaceFolder
  }

  return resolveGitPrimaryWorkspaceFolder(resolveProjectWorkspaceFolder(cwd, env))
}

export const resolveProjectSharedWorkspaceFolder = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => (
  resolveProjectPrimaryWorkspaceFolder(cwd, env) ?? resolveProjectWorkspaceFolder(cwd, env)
)

export const resolveProjectSharedAiBaseDir = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => {
  const sharedWorkspaceFolder = resolveProjectSharedWorkspaceFolder(cwd, env)
  const sharedEnv = {
    ...env,
    [PROJECT_LAUNCH_CWD_ENV]: sharedWorkspaceFolder,
    [PROJECT_WORKSPACE_FOLDER_ENV]: sharedWorkspaceFolder
  }

  return resolveProjectAiBaseDir(sharedWorkspaceFolder, sharedEnv)
}

export const resolveProjectSharedCacheDir = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => (
  resolvePathFromBase(resolveProjectLaunchCwd(cwd, env), env[PROJECT_AI_CACHE_DIR_ENV]) ??
    resolve(resolveProjectSharedAiBaseDir(cwd, env), 'caches')
)

export const resolveProjectSharedCachePath = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env,
  ...segments: string[]
) => resolve(resolveProjectSharedCacheDir(cwd, env), ...segments)
