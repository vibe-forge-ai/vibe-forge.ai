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
const DEFAULT_KIMI_INSTALL_PYTHON = '3.13'
const COMMAND_CHECK_TIMEOUT_MS = 15000

const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const isFalseLike = (value: string) => ['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase())

export const resolveKimiCliInstallOptions = (
  env: AdapterCtx['env'],
  adapterConfig: KimiAdapterConfig = {}
) => {
  const rawAutoInstall = normalizeNonEmptyString(env.__VF_PROJECT_AI_ADAPTER_KIMI_AUTO_INSTALL__)
  return {
    autoInstall: rawAutoInstall == null
      ? adapterConfig.autoInstall !== false
      : !isFalseLike(rawAutoInstall),
    packageName: normalizeNonEmptyString(env.__VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_PACKAGE__) ??
      normalizeNonEmptyString(adapterConfig.installPackage) ??
      DEFAULT_KIMI_INSTALL_PACKAGE,
    python: normalizeNonEmptyString(env.__VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_PYTHON__) ??
      normalizeNonEmptyString(adapterConfig.installPython) ??
      DEFAULT_KIMI_INSTALL_PYTHON,
    uvPath: normalizeNonEmptyString(env.__VF_PROJECT_AI_ADAPTER_KIMI_UV_PATH__) ??
      normalizeNonEmptyString(adapterConfig.uvPath) ??
      'uv'
  }
}

export const buildKimiCliInstallEnv = (
  ctx: Pick<AdapterCtx, 'cwd' | 'env'>
) => {
  const paths = resolveKimiManagedToolPaths(ctx.cwd)
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
  ctx: Pick<AdapterCtx, 'cwd'>,
  options: ReturnType<typeof resolveKimiCliInstallOptions>
) => {
  const paths = resolveKimiManagedToolPaths(ctx.cwd)
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

const ensureManagedDirs = async (ctx: Pick<AdapterCtx, 'cwd'>) => {
  const paths = resolveKimiManagedToolPaths(ctx.cwd)
  await mkdir(paths.binDir, { recursive: true })
  await mkdir(paths.toolDir, { recursive: true })
  await mkdir(paths.cacheDir, { recursive: true })
  await mkdir(paths.pythonDir, { recursive: true })
  await mkdir(paths.pythonBinDir, { recursive: true })
}

export const initKimiAdapter = async (ctx: AdapterCtx) => {
  prepareKimiNativeHooks(ctx)

  const adapterConfig = resolveAdapterConfig(ctx)
  const installOptions = resolveKimiCliInstallOptions(ctx.env, adapterConfig)
  const explicitBinaryPath = normalizeNonEmptyString(ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__)
  const probeEnv = toProcessEnv({
    ...process.env,
    ...ctx.env
  })

  if (explicitBinaryPath != null) {
    if (await canRunKimiBinary(explicitBinaryPath, probeEnv)) return
    throw new Error(`Configured Kimi CLI path is not executable: ${explicitBinaryPath}`)
  }

  const managedBinaryPath = resolveKimiManagedBinaryPath(ctx.cwd)
  if (managedBinaryPath != null && await canRunKimiBinary(managedBinaryPath, probeEnv)) {
    ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__ = managedBinaryPath
    return
  }

  if (await canRunKimiBinary('kimi', probeEnv)) {
    ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__ = 'kimi'
    return
  }

  if (!installOptions.autoInstall) {
    throw new Error(
      `Kimi CLI was not found and automatic install is disabled.\n\n${
        buildKimiCliInstallInstructions(ctx, installOptions)
      }`
    )
  }

  if (!await canRunUvBinary(installOptions.uvPath, probeEnv)) {
    throw new Error(
      `Kimi CLI was not found, and uv is required for automatic install.\n\n${
        buildKimiCliInstallInstructions(ctx, installOptions)
      }`
    )
  }

  await ensureManagedDirs(ctx)
  const installEnv = buildKimiCliInstallEnv(ctx)
  ctx.logger.info(`Installing Kimi CLI into ${resolveKimiManagedToolPaths(ctx.cwd).binDir}`)
  await execFileAsync(
    installOptions.uvPath,
    buildKimiCliInstallArgs(installOptions),
    {
      cwd: ctx.cwd,
      env: installEnv,
      maxBuffer: 1024 * 1024 * 10
    }
  )

  const installedBinaryPath = resolveKimiManagedBinaryPath(ctx.cwd)
  if (installedBinaryPath == null || !await canRunKimiBinary(installedBinaryPath, installEnv)) {
    throw new Error(
      `Kimi CLI installation completed, but the managed kimi binary could not be executed.\n\n${
        buildKimiCliInstallInstructions(ctx, installOptions)
      }`
    )
  }

  ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__ = installedBinaryPath
}
