import { isAbsolute, resolve } from 'node:path'
import process from 'node:process'

export const PROJECT_AI_BASE_DIR_ENV = '__VF_PROJECT_AI_BASE_DIR__'
export const DEFAULT_PROJECT_AI_BASE_DIR = '.ai'
export const PROJECT_AI_ENTITIES_DIR_ENV = '__VF_PROJECT_AI_ENTITIES_DIR__'
export const DEFAULT_PROJECT_AI_ENTITIES_DIR = 'entities'

const normalizeDirPath = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  if (trimmed == null || trimmed === '') return undefined
  return trimmed.replace(/[\\/]+$/, '')
}

const toPathSegments = (value: string) => value.split(/[\\/]+/).filter(Boolean)

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
  return isAbsolute(baseDir) ? resolve(baseDir) : resolve(cwd, baseDir)
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
