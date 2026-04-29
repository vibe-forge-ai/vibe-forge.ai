import { spawnSync } from 'node:child_process'
import { isAbsolute, relative, resolve } from 'node:path'
import process from 'node:process'

export const PROJECT_LAUNCH_CWD_ENV = '__VF_PROJECT_LAUNCH_CWD__'
export const PROJECT_WORKSPACE_FOLDER_ENV = '__VF_PROJECT_WORKSPACE_FOLDER__'
export const PROJECT_CONFIG_DIR_ENV = '__VF_PROJECT_CONFIG_DIR__'
export const PROJECT_AI_BASE_DIR_ENV = '__VF_PROJECT_AI_BASE_DIR__'
export const PROJECT_WORKSPACE_FOLDER_RESOLVE_CWD_ENV = '__VF_PROJECT_WORKSPACE_FOLDER_RESOLVE_CWD__'
export const PROJECT_CONFIG_DIR_RESOLVE_CWD_ENV = '__VF_PROJECT_CONFIG_DIR_RESOLVE_CWD__'
export const PROJECT_AI_BASE_DIR_RESOLVE_CWD_ENV = '__VF_PROJECT_AI_BASE_DIR_RESOLVE_CWD__'
export const DEFAULT_PROJECT_AI_BASE_DIR = '.ai'
export const PROJECT_AI_ENTITIES_DIR_ENV = '__VF_PROJECT_AI_ENTITIES_DIR__'
export const DEFAULT_PROJECT_AI_ENTITIES_DIR = 'entities'
export const PROJECT_PRIMARY_WORKSPACE_FOLDER_ENV = '__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__'

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

const toPathSegments = (value: string) => value.split(/[\\/]+/).filter(Boolean)

const isPathInside = (parentPath: string, targetPath: string) => {
  const relativePath = relative(parentPath, targetPath)
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

export const resolveProjectLaunchCwd = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => (
  resolvePathFromBase(resolve(cwd), env[PROJECT_LAUNCH_CWD_ENV]) ?? resolve(cwd)
)

const resolvePathSourceCwd = (
  cwd: string,
  env: Record<string, string | null | undefined>,
  sourceEnvName: string
) => resolvePathFromBase(cwd, env[sourceEnvName])

const resolvePathFromLaunchCwd = (
  cwd: string,
  value: string | null | undefined,
  env: Record<string, string | null | undefined> = process.env,
  sourceEnvName?: string
) => {
  const baseDir = sourceEnvName == null
    ? resolveProjectLaunchCwd(cwd, env)
    : resolvePathSourceCwd(cwd, env, sourceEnvName) ?? resolveProjectLaunchCwd(cwd, env)

  return resolvePathFromBase(baseDir, value)
}

export const resolveProjectWorkspaceFolder = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => (
  resolvePathFromLaunchCwd(cwd, env[PROJECT_WORKSPACE_FOLDER_ENV], env, PROJECT_WORKSPACE_FOLDER_RESOLVE_CWD_ENV) ??
    resolve(cwd)
)

export const resolvePrimaryWorkspaceFolder = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => {
  const normalizedWorkspaceFolder = resolveProjectWorkspaceFolder(cwd, env)
  const explicitPrimaryWorkspaceFolder = env[PROJECT_PRIMARY_WORKSPACE_FOLDER_ENV]?.trim()
  if (explicitPrimaryWorkspaceFolder != null && explicitPrimaryWorkspaceFolder !== '') {
    const resolvedPrimaryWorkspaceFolder = resolve(explicitPrimaryWorkspaceFolder)
    return resolvedPrimaryWorkspaceFolder === normalizedWorkspaceFolder
      ? undefined
      : resolvedPrimaryWorkspaceFolder
  }

  try {
    const result = spawnSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: normalizedWorkspaceFolder,
      encoding: 'utf8'
    })
    if (result.status !== 0) {
      return undefined
    }

    const gitCommonDir = result.stdout?.trim()
    if (gitCommonDir == null || gitCommonDir === '') {
      return undefined
    }

    const primaryWorkspaceFolder = resolve(normalizedWorkspaceFolder, gitCommonDir, '..')
    return primaryWorkspaceFolder === normalizedWorkspaceFolder
      ? undefined
      : primaryWorkspaceFolder
  } catch {
    return undefined
  }
}

export const resolveProjectConfigDir = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => resolvePathFromLaunchCwd(cwd, env[PROJECT_CONFIG_DIR_ENV], env, PROJECT_CONFIG_DIR_RESOLVE_CWD_ENV)

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
    return resolve(
      resolvePathSourceCwd(cwd, env, PROJECT_AI_BASE_DIR_RESOLVE_CWD_ENV) ?? resolveProjectLaunchCwd(cwd, env),
      baseDir
    )
  }

  return resolve(resolveProjectWorkspaceFolder(cwd, env), baseDir)
}

export const resolveProjectAiPath = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env,
  ...segments: string[]
) => resolve(resolveProjectAiBaseDir(cwd, env), ...segments)

export const resolveProjectMockHome = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => {
  const fallbackMockHome = resolveProjectAiPath(cwd, env, '.mock')
  const explicitHome = normalizeDirPath(env.HOME ?? process.env.HOME)
  const realHome = normalizeDirPath(env.__VF_PROJECT_REAL_HOME__ ?? process.env.__VF_PROJECT_REAL_HOME__)
  const resolvedExplicitHome = explicitHome == null ? undefined : resolve(explicitHome)
  const resolvedRealHome = realHome == null ? undefined : resolve(realHome)
  const workspaceFolder = resolveProjectWorkspaceFolder(cwd, env)

  if (resolvedExplicitHome == null) return fallbackMockHome
  if (resolvedRealHome != null && resolvedExplicitHome === resolvedRealHome) {
    return fallbackMockHome
  }
  if (isPathInside(workspaceFolder, resolvedExplicitHome) && resolvedExplicitHome !== fallbackMockHome) {
    return fallbackMockHome
  }

  return resolvedExplicitHome
}

export const resolveProjectAiEntitiesDir = (
  cwd: string,
  env: Record<string, string | null | undefined> = process.env
) => resolveProjectAiPath(cwd, env, ...toPathSegments(resolveProjectAiEntitiesDirName(env)))
