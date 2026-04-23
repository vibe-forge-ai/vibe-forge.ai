import { join } from 'node:path'
import process from 'node:process'

import type { AdapterCtx } from '@vibe-forge/types'
import { resolveProjectMockHome, syncSymlinkTarget } from '@vibe-forge/utils'
import { ensureManagedNpmCli } from '@vibe-forge/utils/managed-npm-cli'

import { OPENCODE_CLI_PACKAGE, OPENCODE_CLI_VERSION, resolveOpenCodeBinaryPath } from '#~/paths.js'
import { ensureOpenCodeNativeHooksInstalled } from './native-hooks'
import { resolveAdapterConfig } from './session/shared'

const ensureSymlink = async (sourcePath: string, targetPath: string) => {
  await syncSymlinkTarget({
    sourcePath,
    targetPath
  })
}

export const initOpenCodeAdapter = async (ctx: AdapterCtx) => {
  const adapterConfig = resolveAdapterConfig(ctx)
  ctx.env.__VF_PROJECT_AI_ADAPTER_OPENCODE_CLI_PATH__ = await ensureManagedNpmCli({
    adapterKey: 'opencode',
    binaryName: 'opencode',
    bundledPath: resolveOpenCodeBinaryPath(ctx.env, ctx.cwd, adapterConfig.native.cli),
    config: adapterConfig.native.cli,
    cwd: ctx.cwd,
    defaultPackageName: OPENCODE_CLI_PACKAGE,
    defaultVersion: OPENCODE_CLI_VERSION,
    env: ctx.env,
    logger: ctx.logger
  })

  const realHome = ctx.env.__VF_PROJECT_REAL_HOME__?.trim() || process.env.__VF_PROJECT_REAL_HOME__?.trim()
  const aiHome = resolveProjectMockHome(ctx.cwd, ctx.env)

  if (realHome && aiHome) {
    await ensureSymlink(
      join(realHome, '.local', 'share', 'opencode', 'auth.json'),
      join(aiHome, '.local', 'share', 'opencode', 'auth.json')
    )
    await ensureSymlink(
      join(realHome, '.local', 'share', 'opencode', 'mcp-auth.json'),
      join(aiHome, '.local', 'share', 'opencode', 'mcp-auth.json')
    )
  }
  await ensureOpenCodeNativeHooksInstalled(ctx)
}
