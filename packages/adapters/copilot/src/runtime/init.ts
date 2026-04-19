import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import type { AdapterCtx } from '@vibe-forge/types'
import { ensureManagedNpmCli } from '@vibe-forge/utils/managed-npm-cli'

import { COPILOT_CLI_PACKAGE, COPILOT_CLI_VERSION, resolveCopilotBinaryPath } from '#~/paths.js'
import { resolveAdapterConfig, syncCopilotManagedSymlink } from './shared'

const resolveCopilotMockHome = (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => {
  const explicitHome = ctx.env.HOME?.trim() || process.env.HOME?.trim()
  return explicitHome ? resolve(explicitHome) : resolve(ctx.cwd, '.ai', '.mock')
}

const syncCopilotMockHomeSymlink = async (params: {
  sourcePath: string
  targetPath: string
  type: 'dir' | 'file'
}) => {
  await syncCopilotManagedSymlink(params)
}

const syncCopilotMockHomeKeychains = async (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => {
  const realHome = ctx.env.__VF_PROJECT_REAL_HOME__?.trim() || process.env.__VF_PROJECT_REAL_HOME__?.trim()
  const targetPath = resolve(resolveCopilotMockHome(ctx), 'Library', 'Keychains')

  if (realHome == null || realHome === '') {
    await rm(targetPath, { recursive: true, force: true })
    return
  }

  await syncCopilotMockHomeSymlink({
    sourcePath: resolve(realHome, 'Library', 'Keychains'),
    targetPath,
    type: 'dir'
  })
}

export const initCopilotAdapter = async (ctx: AdapterCtx) => {
  const adapterConfig = resolveAdapterConfig(ctx)
  ctx.env.__VF_PROJECT_AI_ADAPTER_COPILOT_CLI_PATH__ = await ensureManagedNpmCli({
    adapterKey: 'copilot',
    binaryName: 'copilot',
    bundledPath: resolveCopilotBinaryPath(ctx.env, adapterConfig.cliPath, ctx.cwd, adapterConfig.cli),
    config: adapterConfig.cli,
    configuredPath: adapterConfig.cliPath,
    cwd: ctx.cwd,
    defaultPackageName: COPILOT_CLI_PACKAGE,
    defaultVersion: COPILOT_CLI_VERSION,
    env: ctx.env,
    logger: ctx.logger
  })

  await syncCopilotMockHomeKeychains(ctx)
}
