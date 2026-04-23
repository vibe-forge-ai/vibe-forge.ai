/* eslint-disable max-lines -- Kimi CLI bootstrap keeps install helpers and init flow together. */
import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'

import type { AdapterCtx } from '@vibe-forge/types'

import { resolveKimiManagedBinaryPath, resolveKimiManagedToolPaths } from '../paths'
import type { KimiAdapterConfig } from './common'
import { resolveAdapterConfig, toProcessEnv } from './common'
import { prepareKimiNativeHooks } from './native-hooks'

const execFileAsync = promisify(execFile)

const DEFAULT_KIMI_INSTALL_PACKAGE = 'kimi-cli'
const DEFAULT_KIMI_INSTALL_VERSION = '1.36.0'
const DEFAULT_KIMI_INSTALL_PYTHON = '3.13'
const COMMAND_CHECK_TIMEOUT_MS = 15000

const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const isFalseLike = (value: string) => ['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase())

const normalizeSource = (value: unknown) => (
  value === 'managed' || value === 'system' || value === 'path' ? value : undefined
)

const hasUvVersionSpec = (packageName: string) => /[<>=!~@]/u.test(packageName)

const toUvPackageSpec = (packageName: string, version?: string) => (
  version != null && !hasUvVersionSpec(packageName) ? `${packageName}==${version}` : packageName
)

export const resolveKimiCliInstallOptions = (
  env: AdapterCtx['env'],
  adapterConfig: KimiAdapterConfig = {}
) => {
  const rawAutoInstall = normalizeNonEmptyString(env.__VF_PROJECT_AI_ADAPTER_KIMI_AUTO_INSTALL__)
  const packageName = normalizeNonEmptyString(env.__VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_PACKAGE__) ??
    normalizeNonEmptyString(adapterConfig.cli?.package) ??
    normalizeNonEmptyString(adapterConfig.installPackage) ??
    DEFAULT_KIMI_INSTALL_PACKAGE
  const version = normalizeNonEmptyString(env.__VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_VERSION__) ??
    normalizeNonEmptyString(adapterConfig.cli?.version) ??
    DEFAULT_KIMI_INSTALL_VERSION
  return {
    autoInstall: rawAutoInstall == null
      ? (adapterConfig.cli?.autoInstall ?? adapterConfig.autoInstall) !== false
      : !isFalseLike(rawAutoInstall),
    binaryPath: normalizeNonEmptyString(env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__) ??
      normalizeNonEmptyString(adapterConfig.cli?.path),
    packageName: toUvPackageSpec(packageName, version),
    python: normalizeNonEmptyString(env.__VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_PYTHON__) ??
      normalizeNonEmptyString(adapterConfig.cli?.python) ??
      normalizeNonEmptyString(adapterConfig.installPython) ??
      DEFAULT_KIMI_INSTALL_PYTHON,
    source: normalizeSource(env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_SOURCE__) ??
      normalizeSource(adapterConfig.cli?.source),
    uvPath: normalizeNonEmptyString(env.__VF_PROJECT_AI_ADAPTER_KIMI_UV_PATH__) ??
      normalizeNonEmptyString(adapterConfig.cli?.uvPath) ??
      normalizeNonEmptyString(adapterConfig.uvPath) ??
      'uv'
  }
}

export const buildKimiCliInstallEnv = (
  ctx: Pick<AdapterCtx, 'cwd' | 'env'>
) => {
  const paths = resolveKimiManagedToolPaths(ctx.cwd, ctx.env)
  return toProcessEnv({
    ...process.env,
    ...ctx.env,
    UV_TOOL_DIR: paths.toolDir,
    UV_TOOL_BIN_DIR: paths.binDir,
    UV_CACHE_DIR: paths.cacheDir,
    UV_PYTHON_INSTALL_DIR: paths.pythonDir,
    UV_PYTHON_BIN_DIR: paths.pythonBinDir,
    UV_NO_MODIFY_PATH: '1'
  })
}

export const buildKimiCliInstallArgs = (
  options: ReturnType<typeof resolveKimiCliInstallOptions>
) => [
  'tool',
  'install',
  '--python',
  options.python,
  options.packageName
]

export const buildKimiCliInstallInstructions = (
  ctx: Pick<AdapterCtx, 'cwd' | 'env'>,
  options: ReturnType<typeof resolveKimiCliInstallOptions>
) => {
  const paths = resolveKimiManagedToolPaths(ctx.cwd, ctx.env)
  const manualInstallCommand = `${options.uvPath} tool install --python ${options.python} ${options.packageName}`
  return [
    'Install Kimi CLI with one of these options:',
    '',
    '1. Use the official Kimi installer. It installs uv first, then installs Kimi CLI via uv:',
    '   macOS/Linux: curl -LsSf https://code.kimi.com/install.sh | bash',
    '   Windows PowerShell: Invoke-RestMethod https://code.kimi.com/install.ps1 | Invoke-Expression',
    '',
    '2. Install uv, then rerun this task. Vibe Forge will install Kimi CLI into the workspace cache:',
    '   macOS/Linux: curl -LsSf https://astral.sh/uv/install.sh | sh',
    '   Homebrew: brew install uv',
    '   Windows PowerShell: powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"',
    `   Managed Kimi bin dir: ${paths.binDir}`,
    '',
    '3. If uv is already installed, install Kimi CLI manually:',
    `   ${manualInstallCommand}`,
    '',
    '4. Or point Vibe Forge at an existing Kimi binary:',
    '   __VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH=/absolute/path/to/kimi',
    '',
    'After installation, run `kimi --version`, then run `kimi` and use `/login` if the CLI has not been configured yet.'
  ].join('\n')
}

const canRunCommand = async (binaryPath: string, args: string[], env?: NodeJS.ProcessEnv) => {
  try {
    await execFileAsync(binaryPath, args, { env, timeout: COMMAND_CHECK_TIMEOUT_MS })
    return true
  } catch {
    return false
  }
}

const canRunKimiBinary = (binaryPath: string, env?: NodeJS.ProcessEnv) => canRunCommand(binaryPath, ['--version'], env)
const canRunUvBinary = (binaryPath: string, env?: NodeJS.ProcessEnv) => canRunCommand(binaryPath, ['--version'], env)

const ensureManagedDirs = async (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => {
  const paths = resolveKimiManagedToolPaths(ctx.cwd, ctx.env)
  await mkdir(paths.binDir, { recursive: true })
  await mkdir(paths.toolDir, { recursive: true })
  await mkdir(paths.cacheDir, { recursive: true })
  await mkdir(paths.pythonDir, { recursive: true })
  await mkdir(paths.pythonBinDir, { recursive: true })
}

export const ensureKimiCli = async (
  ctx: AdapterCtx,
  options: { defaultSource?: 'managed' | 'system' | 'path' } = {}
) => {
  const adapterConfig = resolveAdapterConfig(ctx)
  const resolvedInstallOptions = resolveKimiCliInstallOptions(ctx.env, adapterConfig)
  const installOptions = {
    ...resolvedInstallOptions,
    source: resolvedInstallOptions.source ?? options.defaultSource
  }
  const probeEnv = toProcessEnv({
    ...process.env,
    ...ctx.env
  })
  const canUseManagedCli = installOptions.source !== 'system'
  const canUseSystemCli = installOptions.source !== 'managed'

  if (installOptions.binaryPath != null) {
    if (await canRunKimiBinary(installOptions.binaryPath, probeEnv)) {
      ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__ = installOptions.binaryPath
      return installOptions.binaryPath
    }
    throw new Error(`Configured Kimi CLI path is not executable: ${installOptions.binaryPath}`)
  }

  if (installOptions.source === 'path') {
    throw new Error('Kimi CLI source is set to path, but no Kimi CLI path is configured.')
  }

  if (canUseManagedCli) {
    const managedBinaryPath = resolveKimiManagedBinaryPath(ctx.cwd, ctx.env)
    if (managedBinaryPath != null && await canRunKimiBinary(managedBinaryPath, probeEnv)) {
      ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__ = managedBinaryPath
      return managedBinaryPath
    }
  }

  if (installOptions.source === 'system') {
    if (await canRunKimiBinary('kimi', probeEnv)) {
      ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__ = 'kimi'
      return 'kimi'
    }
    throw new Error('Kimi CLI was not found on PATH.')
  }

  if (canUseManagedCli && installOptions.autoInstall && await canRunUvBinary(installOptions.uvPath, probeEnv)) {
    await ensureManagedDirs(ctx)
    const installEnv = buildKimiCliInstallEnv(ctx)
    ctx.logger.info(`Installing Kimi CLI into ${resolveKimiManagedToolPaths(ctx.cwd, ctx.env).binDir}`)
    await execFileAsync(
      installOptions.uvPath,
      buildKimiCliInstallArgs(installOptions),
      {
        cwd: ctx.cwd,
        env: installEnv,
        maxBuffer: 1024 * 1024 * 10
      }
    )

    const installedBinaryPath = resolveKimiManagedBinaryPath(ctx.cwd, ctx.env)
    if (installedBinaryPath == null || !await canRunKimiBinary(installedBinaryPath, installEnv)) {
      throw new Error(
        `Kimi CLI installation completed, but the managed kimi binary could not be executed.\n\n${
          buildKimiCliInstallInstructions(ctx, installOptions)
        }`
      )
    }

    ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__ = installedBinaryPath
    return installedBinaryPath
  }

  if (canUseSystemCli && await canRunKimiBinary('kimi', probeEnv)) {
    ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__ = 'kimi'
    return 'kimi'
  }

  if (!installOptions.autoInstall) {
    throw new Error(
      `Kimi CLI was not found and automatic install is disabled.\n\n${
        buildKimiCliInstallInstructions(ctx, installOptions)
      }`
    )
  }

  throw new Error(
    `Kimi CLI was not found, and uv is required for automatic install.\n\n${
      buildKimiCliInstallInstructions(ctx, installOptions)
    }`
  )
}

export const initKimiAdapter = async (ctx: AdapterCtx) => {
  prepareKimiNativeHooks(ctx)
  await ensureKimiCli(ctx)
}
