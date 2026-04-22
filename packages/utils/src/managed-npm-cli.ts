/* eslint-disable max-lines -- shared managed CLI resolver intentionally centralizes install policy. */
import { execFile } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

import type { Logger } from '@vibe-forge/types'

import { resolveProjectSharedCachePath } from './project-cache-path'

export interface ManagedNpmCliConfig {
  source?: 'managed' | 'system' | 'path'
  path?: string
  package?: string
  version?: string
  autoInstall?: boolean
  prepareOnInstall?: boolean
  npmPath?: string
}

export interface ManagedNpmCliInstallOptions {
  autoInstall: boolean
  npmPath: string
  packageName: string
  packageSpec: string
  source?: 'managed' | 'system' | 'path'
  version: string
}

export interface ManagedNpmCliPaths {
  rootDir: string
  installDir: string
  cacheDir: string
  binDir: string
  binaryPath: string
}

interface ResolveManagedNpmCliOptionsParams {
  adapterKey: string
  defaultPackageName: string
  defaultVersion: string
  env: Record<string, string | null | undefined>
  config?: ManagedNpmCliConfig
}

interface ResolveManagedNpmCliPathParams extends ResolveManagedNpmCliOptionsParams {
  binaryName: string
  bundledPath?: string
  cwd?: string
  configuredPath?: string
  versionArgs?: string[]
}

interface EnsureManagedNpmCliParams extends ResolveManagedNpmCliPathParams {
  cwd: string
  logger: Pick<Logger, 'info'>
}

const execFileAsync = promisify(execFile)
const COMMAND_CHECK_TIMEOUT_MS = 15000

const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const isFalseLike = (value: string) => ['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase())

const normalizeAdapterEnvPrefix = (adapterKey: string) => (
  `__VF_PROJECT_AI_ADAPTER_${adapterKey.replace(/[^a-z0-9]+/giu, '_').toUpperCase()}`
)

const normalizeSource = (value: unknown): ManagedNpmCliInstallOptions['source'] => (
  value === 'managed' || value === 'system' || value === 'path' ? value : undefined
)

const toCacheSegment = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cli'
)

const hasExplicitPackageVersion = (packageName: string) => {
  const lastAt = packageName.lastIndexOf('@')
  if (!packageName.startsWith('@')) return lastAt > 0
  const slash = packageName.indexOf('/')
  return slash > 0 && lastAt > slash
}

const toPackageSpec = (packageName: string, version: string) => (
  hasExplicitPackageVersion(packageName) ? packageName : `${packageName}@${version}`
)

const toRealPath = (targetPath: string) => {
  try {
    return realpathSync(targetPath)
  } catch {
    return targetPath
  }
}

const canRunCommand = async (binaryPath: string, args: string[], env?: NodeJS.ProcessEnv) => {
  try {
    await execFileAsync(binaryPath, args, { env, timeout: COMMAND_CHECK_TIMEOUT_MS })
    return true
  } catch {
    return false
  }
}

const normalizeVersionArgs = (versionArgs: string[] | undefined) => (
  versionArgs == null || versionArgs.length === 0 ? ['--version'] : versionArgs
)

const canRunBinary = (binaryPath: string, versionArgs: string[] | undefined, env?: NodeJS.ProcessEnv) =>
  canRunCommand(binaryPath, normalizeVersionArgs(versionArgs), env)
const canRunNpm = (binaryPath: string, env?: NodeJS.ProcessEnv) => canRunCommand(binaryPath, ['--version'], env)

export const resolveManagedNpmCliInstallOptions = (
  params: ResolveManagedNpmCliOptionsParams
): ManagedNpmCliInstallOptions => {
  const envPrefix = normalizeAdapterEnvPrefix(params.adapterKey)
  const rawAutoInstall = normalizeNonEmptyString(params.env[`${envPrefix}_AUTO_INSTALL__`])
  const packageName = normalizeNonEmptyString(params.env[`${envPrefix}_INSTALL_PACKAGE__`]) ??
    normalizeNonEmptyString(params.config?.package) ??
    params.defaultPackageName
  const version = normalizeNonEmptyString(params.env[`${envPrefix}_INSTALL_VERSION__`]) ??
    normalizeNonEmptyString(params.config?.version) ??
    params.defaultVersion

  return {
    autoInstall: rawAutoInstall == null
      ? params.config?.autoInstall !== false
      : !isFalseLike(rawAutoInstall),
    npmPath: normalizeNonEmptyString(params.env[`${envPrefix}_NPM_PATH__`]) ??
      normalizeNonEmptyString(params.config?.npmPath) ??
      'npm',
    packageName,
    packageSpec: toPackageSpec(packageName, version),
    source: normalizeSource(params.env[`${envPrefix}_CLI_SOURCE__`]) ?? normalizeSource(params.config?.source),
    version
  }
}

export const resolveManagedNpmCliPaths = (params: {
  adapterKey: string
  binaryName: string
  cwd: string
  env: Record<string, string | null | undefined>
  packageName: string
  version: string
}): ManagedNpmCliPaths => {
  const rootDir = resolveProjectSharedCachePath(params.cwd, params.env, `adapter-${params.adapterKey}`, 'cli', 'npm')
  const installDir = resolve(rootDir, toCacheSegment(params.packageName), toCacheSegment(params.version))
  const binDir = resolve(installDir, 'node_modules', '.bin')
  return {
    rootDir,
    installDir,
    cacheDir: resolve(rootDir, '.npm-cache'),
    binDir,
    binaryPath: resolve(binDir, params.binaryName)
  }
}

export const resolveManagedNpmCliBinaryPath = (params: ResolveManagedNpmCliPathParams) => {
  const envPrefix = normalizeAdapterEnvPrefix(params.adapterKey)
  const installOptions = resolveManagedNpmCliInstallOptions(params)
  const explicitPath = normalizeNonEmptyString(params.env[`${envPrefix}_CLI_PATH__`]) ??
    normalizeNonEmptyString(params.configuredPath) ??
    normalizeNonEmptyString(params.config?.path)

  if (explicitPath != null) return explicitPath
  if (installOptions.source === 'system') return params.binaryName

  if (params.cwd != null && params.cwd.trim() !== '') {
    const paths = resolveManagedNpmCliPaths({
      adapterKey: params.adapterKey,
      binaryName: params.binaryName,
      cwd: params.cwd,
      env: params.env,
      packageName: installOptions.packageName,
      version: installOptions.version
    })
    if (existsSync(paths.binaryPath) || installOptions.source === 'managed') {
      return toRealPath(paths.binaryPath)
    }
  }

  if (installOptions.source !== 'managed' && params.bundledPath != null && existsSync(params.bundledPath)) {
    return toRealPath(params.bundledPath)
  }

  return params.binaryName
}

export const buildManagedNpmCliInstallEnv = (params: {
  cwd: string
  env: Record<string, string | null | undefined>
  paths: ManagedNpmCliPaths
}) => ({
  ...process.env,
  ...Object.fromEntries(
    Object.entries(params.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  ),
  npm_config_cache: params.paths.cacheDir
})

export const buildManagedNpmCliInstallInstructions = (params: {
  adapterKey: string
  binaryName: string
  options: ManagedNpmCliInstallOptions
  paths: ManagedNpmCliPaths
}) =>
  [
    `Install ${params.binaryName} CLI with one of these options:`,
    '',
    '1. Let Vibe Forge install the managed CLI into the workspace cache:',
    `   ${params.options.npmPath} install --prefix ${params.paths.installDir} --no-save ${params.options.packageSpec}`,
    '',
    '2. Install it yourself and point Vibe Forge at the binary:',
    `   __VF_PROJECT_AI_ADAPTER_${
      params.adapterKey.replace(/[^a-z0-9]+/giu, '_').toUpperCase()
    }_CLI_PATH__=/absolute/path/to/${params.binaryName}`,
    '',
    `Managed ${params.binaryName} bin dir: ${params.paths.binDir}`
  ].join('\n')

export const ensureManagedNpmCli = async (params: EnsureManagedNpmCliParams) => {
  const installOptions = resolveManagedNpmCliInstallOptions(params)
  const paths = resolveManagedNpmCliPaths({
    adapterKey: params.adapterKey,
    binaryName: params.binaryName,
    cwd: params.cwd,
    env: params.env,
    packageName: installOptions.packageName,
    version: installOptions.version
  })
  const probeEnv = {
    ...process.env,
    ...Object.fromEntries(
      Object.entries(params.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )
  }
  const explicitPath = resolveManagedNpmCliBinaryPath({
    ...params,
    config: {
      ...params.config,
      source: params.config?.source === 'path' ? 'path' : undefined
    }
  })

  if (explicitPath !== params.binaryName && explicitPath !== toRealPath(paths.binaryPath)) {
    return explicitPath
  }

  if (existsSync(paths.binaryPath) && await canRunBinary(paths.binaryPath, params.versionArgs, probeEnv)) {
    return toRealPath(paths.binaryPath)
  }

  if (
    installOptions.source !== 'managed' && params.bundledPath != null &&
    await canRunBinary(params.bundledPath, params.versionArgs, probeEnv)
  ) {
    return toRealPath(params.bundledPath)
  }

  if (installOptions.source !== 'managed' && await canRunBinary(params.binaryName, params.versionArgs, probeEnv)) {
    return params.binaryName
  }

  if (!installOptions.autoInstall) {
    throw new Error(
      `${params.binaryName} CLI was not found and automatic install is disabled.\n\n${
        buildManagedNpmCliInstallInstructions({
          adapterKey: params.adapterKey,
          binaryName: params.binaryName,
          options: installOptions,
          paths
        })
      }`
    )
  }

  if (!await canRunNpm(installOptions.npmPath, probeEnv)) {
    throw new Error(
      `${params.binaryName} CLI was not found, and npm is required for automatic install.\n\n${
        buildManagedNpmCliInstallInstructions({
          adapterKey: params.adapterKey,
          binaryName: params.binaryName,
          options: installOptions,
          paths
        })
      }`
    )
  }

  await mkdir(paths.installDir, { recursive: true })
  await mkdir(paths.cacheDir, { recursive: true })
  const installEnv = buildManagedNpmCliInstallEnv({
    cwd: params.cwd,
    env: params.env,
    paths
  })
  params.logger.info(`Installing ${params.binaryName} CLI into ${paths.installDir}`)
  await execFileAsync(
    installOptions.npmPath,
    [
      'install',
      '--prefix',
      paths.installDir,
      '--no-save',
      '--no-audit',
      '--no-fund',
      installOptions.packageSpec
    ],
    {
      cwd: params.cwd,
      env: installEnv,
      maxBuffer: 1024 * 1024 * 10
    }
  )

  if (!await canRunBinary(paths.binaryPath, params.versionArgs, installEnv)) {
    throw new Error(
      `${params.binaryName} CLI installation completed, but the managed binary could not be executed.\n\n${
        buildManagedNpmCliInstallInstructions({
          adapterKey: params.adapterKey,
          binaryName: params.binaryName,
          options: installOptions,
          paths
        })
      }`
    )
  }

  return toRealPath(paths.binaryPath)
}
