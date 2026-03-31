import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV } from './native'

export interface NativeHookBridgeModule {
  isNativeHookEnv: () => boolean
  runHookBridge: () => Promise<void> | void
}

export interface NativeHookBridgeLoaderDeps {
  hasHookBridgeExport: (packageName: string) => boolean
  loadHookBridge: (packageName: string) => unknown
  readAdapterScopeEntries: (scopeDir: string) => string[]
  resolveSearchPaths: () => string[]
}

const HOOK_BRIDGE_EXPORT_SUFFIX = '/hook-bridge'
const ADAPTER_SCOPE = '@vibe-forge'
const ADAPTER_PREFIX = 'adapter-'

const createWorkspaceRequire = () => {
  const workspaceFolder = process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd()
  return createRequire(path.resolve(workspaceFolder, '__vf-hook-loader__.js'))
}

const resolveAdapterPackageName = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.startsWith('@')) return trimmed
  if (trimmed.startsWith(ADAPTER_PREFIX)) return `${ADAPTER_SCOPE}/${trimmed}`
  return `${ADAPTER_SCOPE}/${ADAPTER_PREFIX}${trimmed}`
}

const isHookBridgeResolveMiss = (error: unknown) => {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  return code === 'MODULE_NOT_FOUND' || code === 'ERR_PACKAGE_PATH_NOT_EXPORTED'
}

const isNativeHookBridgeModule = (value: unknown): value is NativeHookBridgeModule => {
  if (value == null || typeof value !== 'object') return false

  return (
    typeof (value as NativeHookBridgeModule).isNativeHookEnv === 'function' &&
    typeof (value as NativeHookBridgeModule).runHookBridge === 'function'
  )
}

export const readInstalledAdapterScopeEntries = (scopeDir: string) => {
  if (!existsSync(scopeDir)) return []

  return readdirSync(scopeDir, { withFileTypes: true })
    .filter(entry => (
      entry.name.startsWith(ADAPTER_PREFIX) &&
      (entry.isDirectory() || entry.isSymbolicLink())
    ))
    .map(entry => entry.name)
}

export const resolvePreferredNativeHookBridgePackage = (
  env: NodeJS.ProcessEnv = process.env
) => {
  const value = env[NATIVE_HOOK_BRIDGE_ADAPTER_ENV]?.trim()
  return value ? resolveAdapterPackageName(value) : undefined
}

const defaultLoaderDeps: NativeHookBridgeLoaderDeps = {
  resolveSearchPaths: () => createWorkspaceRequire().resolve.paths(`${ADAPTER_SCOPE}/adapter-placeholder`) ?? [],
  readAdapterScopeEntries: readInstalledAdapterScopeEntries,
  hasHookBridgeExport: (packageName) => {
    try {
      createWorkspaceRequire().resolve(`${packageName}${HOOK_BRIDGE_EXPORT_SUFFIX}`)
      return true
    } catch (error) {
      if (isHookBridgeResolveMiss(error)) return false
      throw error
    }
  },
  loadHookBridge: packageName => createWorkspaceRequire()(`${packageName}${HOOK_BRIDGE_EXPORT_SUFFIX}`)
}

const tryLoadNativeHookBridge = (
  packageName: string,
  deps: NativeHookBridgeLoaderDeps
) => {
  try {
    if (!deps.hasHookBridgeExport(packageName)) return undefined

    const bridgeModule = deps.loadHookBridge(packageName)
    if (!isNativeHookBridgeModule(bridgeModule)) return undefined
    return bridgeModule.isNativeHookEnv() ? bridgeModule : undefined
  } catch {
    return undefined
  }
}

export const listInstalledAdapterPackages = (
  deps: NativeHookBridgeLoaderDeps = defaultLoaderDeps
) => {
  const packages = new Set<string>()

  for (const searchPath of deps.resolveSearchPaths()) {
    const scopeDir = path.resolve(searchPath, ADAPTER_SCOPE)
    for (const entry of deps.readAdapterScopeEntries(scopeDir)) {
      packages.add(`${ADAPTER_SCOPE}/${entry}`)
    }
  }

  return [...packages].sort()
}

export const resolveActiveNativeHookBridge = (
  deps: NativeHookBridgeLoaderDeps = defaultLoaderDeps,
  env: NodeJS.ProcessEnv = process.env
) => {
  const preferredPackage = resolvePreferredNativeHookBridgePackage(env)
  if (preferredPackage) {
    const preferredBridge = tryLoadNativeHookBridge(preferredPackage, deps)
    if (preferredBridge) return preferredBridge
  }

  for (const packageName of listInstalledAdapterPackages(deps)) {
    if (packageName === preferredPackage) continue
    const bridgeModule = tryLoadNativeHookBridge(packageName, deps)
    if (bridgeModule) return bridgeModule
  }

  return undefined
}
