import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'

export const PROJECT_LAUNCH_CWD_ENV = '__VF_PROJECT_LAUNCH_CWD__'
export const PROJECT_WORKSPACE_FOLDER_ENV = '__VF_PROJECT_WORKSPACE_FOLDER__'
export const PROJECT_CONFIG_DIR_ENV = '__VF_PROJECT_CONFIG_DIR__'
export const PROJECT_AI_BASE_DIR_ENV = '__VF_PROJECT_AI_BASE_DIR__'
export const DEFAULT_PROJECT_AI_BASE_DIR = '.ai'
export const PROJECT_AI_ENTITIES_DIR_ENV = '__VF_PROJECT_AI_ENTITIES_DIR__'
export const DEFAULT_PROJECT_AI_ENTITIES_DIR = 'entities'

const normalizeDirPath = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  if (trimmed == null || trimmed === '') return undefined
  return trimmed.replace(/[\\/]+$/, '')
}

const resolvePathFromBase = (
  baseDir: string,
  value: string | null | undefined,
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

const toPathSegments = (value: string) => value.split(/[\\/]+/).filter(Boolean)

export const resolveProjectLaunchCwd = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => (
  resolvePathFromBase(resolve(cwd), env[PROJECT_LAUNCH_CWD_ENV]) ?? resolve(cwd)
)

const resolvePathFromLaunchCwd = (
  cwd: string,
  value: string | null | undefined,
  env: Record<string, string | null | undefined> = process.env
) => resolvePathFromBase(resolveProjectLaunchCwd(cwd, env), value)

export const resolveProjectWorkspaceFolder = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => (
  resolvePathFromLaunchCwd(cwd, env[PROJECT_WORKSPACE_FOLDER_ENV], env) ?? resolve(cwd)
)

export const resolveProjectConfigDir = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => resolvePathFromLaunchCwd(cwd, env[PROJECT_CONFIG_DIR_ENV], env)

export const resolveProjectAiBaseDirName = (
  env: Record<string, string | null | undefined> = process.env
) => (
  normalizeDirPath(env[PROJECT_AI_BASE_DIR_ENV]) ?? DEFAULT_PROJECT_AI_BASE_DIR
)

export const resolveProjectAiEntitiesDirName = (
  env: Record<string, string | null | undefined> = process.env
) => (
  normalizeDirPath(env[PROJECT_AI_ENTITIES_DIR_ENV]) ?? DEFAULT_PROJECT_AI_ENTITIES_DIR
)

export const resolveProjectAiBaseDir = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => {
  const baseDir = resolveProjectAiBaseDirName(env)
  if (isAbsolute(baseDir)) {
    return resolve(baseDir)
  }

  if (normalizeDirPath(env[PROJECT_AI_BASE_DIR_ENV]) != null) {
    return resolve(resolveProjectLaunchCwd(cwd, env), baseDir)
  }

  return resolve(resolveProjectWorkspaceFolder(cwd, env), baseDir)
}

export const resolveProjectAiPath = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env,
  ...segments: string[]
) => resolve(resolveProjectAiBaseDir(cwd, env), ...segments)

export const resolveProjectAiEntitiesDir = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => resolveProjectAiPath(cwd, env, ...toPathSegments(resolveProjectAiEntitiesDirName(env)))
