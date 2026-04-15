import { access, readFile, readdir, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

import type { ManagedPluginAdapter, ManagedPluginInstallConfig, PluginConfig } from '@vibe-forge/types'

import { resolveProjectAiPath } from './ai-path'

const MANAGED_PLUGIN_CONFIG_FILE = '.vf-plugin.json'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)
const isManagedPluginAdapter = (value: unknown): value is ManagedPluginAdapter => (
  typeof value === 'string' && value.trim() !== ''
)
const isManagedPluginSource = (value: unknown): value is ManagedPluginInstallConfig['source'] => {
  if (!isRecord(value) || typeof value.type !== 'string') return false

  switch (value.type) {
    case 'npm':
      return typeof value.spec === 'string' && value.spec.trim() !== '' && (
        value.registry == null || (typeof value.registry === 'string' && value.registry.trim() !== '')
      )
    case 'github':
      return typeof value.repo === 'string' && value.repo.trim() !== '' && (
        value.ref == null || (typeof value.ref === 'string' && value.ref.trim() !== '')
      ) && (
        value.sha == null || (typeof value.sha === 'string' && value.sha.trim() !== '')
      )
    case 'git':
      return typeof value.url === 'string' && value.url.trim() !== '' && (
        value.ref == null || (typeof value.ref === 'string' && value.ref.trim() !== '')
      ) && (
        value.sha == null || (typeof value.sha === 'string' && value.sha.trim() !== '')
      )
    case 'git-subdir':
      return typeof value.url === 'string' && value.url.trim() !== '' &&
        typeof value.path === 'string' && value.path.trim() !== '' && (
          value.ref == null || (typeof value.ref === 'string' && value.ref.trim() !== '')
        ) && (
          value.sha == null || (typeof value.sha === 'string' && value.sha.trim() !== '')
        )
    case 'path':
      return typeof value.path === 'string' && value.path.trim() !== ''
    case 'marketplace':
      return typeof value.marketplace === 'string' && value.marketplace.trim() !== '' &&
        typeof value.plugin === 'string' && value.plugin.trim() !== ''
    default:
      return false
  }
}
const normalizeManagedPluginConfig = (value: unknown, filePath: string): ManagedPluginInstallConfig | undefined => {
  if (!isRecord(value)) return undefined
  if (value.version !== 1) return undefined
  if (!isManagedPluginAdapter(value.adapter)) return undefined
  if (typeof value.name !== 'string' || value.name.trim() === '') {
    throw new Error(`Invalid managed plugin config at ${filePath}. "name" must be a non-empty string.`)
  }
  if (!isManagedPluginSource(value.source)) {
    throw new Error(`Invalid managed plugin config at ${filePath}. "source" is invalid.`)
  }
  if (typeof value.nativePluginPath !== 'string' || value.nativePluginPath.trim() === '') {
    throw new Error(`Invalid managed plugin config at ${filePath}. "nativePluginPath" is required.`)
  }
  if (typeof value.vibeForgePluginPath !== 'string' || value.vibeForgePluginPath.trim() === '') {
    throw new Error(`Invalid managed plugin config at ${filePath}. "vibeForgePluginPath" is required.`)
  }
  if (typeof value.installedAt !== 'string' || value.installedAt.trim() === '') {
    throw new Error(`Invalid managed plugin config at ${filePath}. "installedAt" is required.`)
  }

  return {
    version: 1,
    adapter: value.adapter,
    name: value.name.trim(),
    scope: typeof value.scope === 'string' && value.scope.trim() !== '' ? value.scope.trim() : undefined,
    installedAt: value.installedAt,
    source: value.source,
    nativePluginPath: value.nativePluginPath,
    vibeForgePluginPath: value.vibeForgePluginPath
  }
}
export interface ManagedPluginInstall {
  config: ManagedPluginInstallConfig
  installDir: string
  nativePluginDir: string
  vibeForgePluginDir: string
}
export const getManagedPluginsRoot = (cwd: string) => resolveProjectAiPath(cwd, undefined, 'plugins')
export const getManagedPluginConfigPath = (installDir: string) => resolve(installDir, MANAGED_PLUGIN_CONFIG_FILE)
const isOutsideInstallDir = (relativePath: string) => (
  relativePath === '..' ||
  relativePath.startsWith('../') ||
  relativePath.startsWith('..\\') ||
  isAbsolute(relativePath)
)
const assertManagedPluginSubpath = async (
  installDir: string,
  rawPath: string,
  fieldName: 'nativePluginPath' | 'vibeForgePluginPath',
  filePath: string
) => {
  const trimmed = rawPath.trim()
  if (trimmed === '') {
    throw new Error(`Invalid managed plugin config at ${filePath}. "${fieldName}" is required.`)
  }
  if (isAbsolute(trimmed)) {
    throw new Error(`Invalid managed plugin config at ${filePath}. "${fieldName}" must stay inside the install dir.`)
  }

  const resolvedPath = resolve(installDir, trimmed)
  const relativePath = relative(installDir, resolvedPath)
  if (isOutsideInstallDir(relativePath)) {
    throw new Error(`Invalid managed plugin config at ${filePath}. "${fieldName}" must stay inside the install dir.`)
  }

  try {
    const [realInstallDir, realResolvedPath] = await Promise.all([
      realpath(installDir),
      realpath(resolvedPath)
    ])
    const realRelativePath = relative(realInstallDir, realResolvedPath)
    if (isOutsideInstallDir(realRelativePath)) {
      throw new Error(`Invalid managed plugin config at ${filePath}. "${fieldName}" resolves outside the install dir.`)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw error
    }
  }

  return trimmed
}
export const readManagedPluginInstall = async (installDir: string): Promise<ManagedPluginInstall | undefined> => {
  const configPath = getManagedPluginConfigPath(installDir)
  try {
    await access(configPath)
  } catch {
    return undefined
  }

  const raw = JSON.parse(await readFile(configPath, 'utf8')) as unknown
  const config = normalizeManagedPluginConfig(raw, configPath)
  if (config == null) return undefined
  const [nativePluginPath, vibeForgePluginPath] = await Promise.all([
    assertManagedPluginSubpath(installDir, config.nativePluginPath, 'nativePluginPath', configPath),
    assertManagedPluginSubpath(installDir, config.vibeForgePluginPath, 'vibeForgePluginPath', configPath)
  ])
  return {
    config: {
      ...config,
      nativePluginPath,
      vibeForgePluginPath
    },
    installDir,
    nativePluginDir: resolve(installDir, nativePluginPath),
    vibeForgePluginDir: resolve(installDir, vibeForgePluginPath)
  }
}
export const listManagedPluginInstalls = async (
  cwd: string,
  options?: {
    adapter?: ManagedPluginAdapter
  }
) => {
  const root = getManagedPluginsRoot(cwd)
  try {
    const entries = await readdir(root, { withFileTypes: true })
    const installDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => resolve(root, entry.name))
    const installs = await Promise.allSettled(
      installDirs.map(installDir => readManagedPluginInstall(installDir))
    )
    return installs
      .flatMap((install, index) => {
        if (install.status === 'fulfilled') {
          return install.value == null ? [] : [install.value]
        }

        console.warn(
          `Skipping invalid managed plugin install at ${installDirs[index]}: ${
            install.reason instanceof Error ? install.reason.message : String(install.reason)
          }`
        )
        return []
      })
      .filter(install => options?.adapter == null || install.config.adapter === options.adapter)
      .sort((left, right) => left.config.name.localeCompare(right.config.name))
  } catch {
    return []
  }
}
export const toManagedPluginConfig = (installs: ManagedPluginInstall[]): PluginConfig => installs.map(install => ({
  id: install.vibeForgePluginDir,
  scope: install.config.scope ?? install.config.name
}))
