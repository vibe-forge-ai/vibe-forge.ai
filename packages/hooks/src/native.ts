import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

export interface NativeHookHandlerConfig {
  type: 'command'
  command: string
  timeout?: number
  statusMessage?: string
}

export interface NativeHookMatcherGroup {
  matcher?: string
  hooks?: NativeHookHandlerConfig[]
}

export interface NativeHooksConfigFile {
  hooks?: Partial<Record<string, NativeHookMatcherGroup[]>> & Record<string, unknown>
}

export const NATIVE_HOOK_BRIDGE_ADAPTER_ENV = '__VF_VIBE_FORGE_HOOK_BRIDGE_ADAPTER__'

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

export const hasManagedHookPlugins = (
  ctx: {
    assets?: {
      hookPlugins?: unknown[]
    }
  }
) => (ctx.assets?.hookPlugins?.length ?? 0) > 0

export const resolveMockHome = (
  cwd: string,
  env: Record<string, string | null | undefined>
) => {
  const explicitHome = env.HOME?.trim() || process.env.HOME?.trim()
  return explicitHome ? resolve(explicitHome) : resolve(cwd, '.ai', '.mock')
}

export const resolveManagedHookPackageDir = () => {
  try {
    const pkgJsonPath = require.resolve('@vibe-forge/hooks/package.json')
    return dirname(pkgJsonPath)
  } catch (error) {
    throw new Error('Failed to resolve @vibe-forge/hooks managed hook entry', { cause: error })
  }
}

export const resolveManagedHookScriptPath = (fileName: string) => (
  resolve(resolveManagedHookPackageDir(), fileName)
)

export const shellQuote = (value: string) => JSON.stringify(value)

export const buildNodeScriptCommand = (params: {
  nodePath: string
  scriptPath: string
}) => `${shellQuote(params.nodePath)} ${shellQuote(params.scriptPath)}`

export const prepareManagedHookRuntime = (
  ctx: {
    cwd: string
    env: Record<string, string | null | undefined>
  }
) => {
  const mockHome = resolveMockHome(ctx.cwd, ctx.env)
  const nodePath = process.execPath

  ctx.env.__VF_PROJECT_WORKSPACE_FOLDER__ = ctx.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? ctx.cwd
  ctx.env.__VF_PROJECT_NODE_PATH__ = nodePath

  return {
    mockHome,
    nodePath
  }
}

export const readJsonFileOrDefault = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return fallback
    throw error
  }
}

export const writeJsonFile = async (filePath: string, value: unknown) => {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export const mergeManagedHookGroups = (params: {
  existing: unknown
  eventNames: readonly string[]
  enabled: boolean
  isManagedGroup: (group: NativeHookMatcherGroup) => boolean
  createGroup: (eventName: string) => NativeHookMatcherGroup
  shouldManageEvent?: (eventName: string) => boolean
}): NativeHooksConfigFile => {
  const parsed = isPlainObject(params.existing) ? params.existing as NativeHooksConfigFile : {}
  const hooks = isPlainObject(parsed.hooks)
    ? parsed.hooks as NonNullable<NativeHooksConfigFile['hooks']>
    : {}
  const nextHooks: Record<string, unknown> = { ...hooks }

  for (const eventName of params.eventNames) {
    const groups = Array.isArray(hooks[eventName])
      ? (hooks[eventName] as NativeHookMatcherGroup[]).filter(group => !params.isManagedGroup(group))
      : []
    nextHooks[eventName] = params.enabled && (params.shouldManageEvent?.(eventName) ?? true)
      ? [...groups, params.createGroup(eventName)]
      : groups
  }

  return {
    ...parsed,
    hooks: nextHooks as NativeHooksConfigFile['hooks']
  }
}
