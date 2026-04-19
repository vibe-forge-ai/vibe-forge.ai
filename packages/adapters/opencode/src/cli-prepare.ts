import { defineAdapterCliPreparer } from '@vibe-forge/types'
import { ensureManagedNpmCli } from '@vibe-forge/utils/managed-npm-cli'

import { OPENCODE_CLI_PACKAGE, OPENCODE_CLI_VERSION, resolveOpenCodeBinaryPath } from '#~/paths.js'
import { resolveAdapterConfig } from '#~/runtime/session/shared.js'

export default defineAdapterCliPreparer({
  adapter: 'opencode',
  title: 'OpenCode',
  targets: [{
    key: 'cli',
    title: 'OpenCode CLI',
    aliases: ['opencode'],
    configPath: ['cli']
  }],
  prepare: async (ctx) => {
    const adapterConfig = resolveAdapterConfig(ctx as Parameters<typeof resolveAdapterConfig>[0])
    const binaryPath = await ensureManagedNpmCli({
      adapterKey: 'opencode',
      binaryName: 'opencode',
      bundledPath: resolveOpenCodeBinaryPath(ctx.env, ctx.cwd, adapterConfig.native.cli),
      config: {
        ...adapterConfig.native.cli,
        source: adapterConfig.native.cli?.source ?? 'managed'
      },
      cwd: ctx.cwd,
      defaultPackageName: OPENCODE_CLI_PACKAGE,
      defaultVersion: OPENCODE_CLI_VERSION,
      env: ctx.env,
      logger: ctx.logger
    })

    return {
      adapter: 'opencode',
      target: 'cli',
      title: 'OpenCode CLI',
      binaryPath
    }
  }
})
