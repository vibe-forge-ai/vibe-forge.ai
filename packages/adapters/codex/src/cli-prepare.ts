import { defineAdapterCliPreparer } from '@vibe-forge/types'
import { ensureManagedNpmCli } from '@vibe-forge/utils/managed-npm-cli'

import { CODEX_CLI_PACKAGE, CODEX_CLI_VERSION, resolveCodexBinaryPath } from '#~/paths.js'
import { resolveCodexAdapterConfig } from '#~/runtime/config.js'

export default defineAdapterCliPreparer({
  adapter: 'codex',
  title: 'Codex',
  targets: [{
    key: 'cli',
    title: 'Codex CLI',
    aliases: ['codex'],
    configPath: ['cli']
  }],
  prepare: async (ctx) => {
    const { native: adapterConfig } = resolveCodexAdapterConfig(ctx)
    const binaryPath = await ensureManagedNpmCli({
      adapterKey: 'codex',
      binaryName: 'codex',
      bundledPath: resolveCodexBinaryPath(ctx.env, ctx.cwd),
      config: {
        ...adapterConfig.cli,
        source: adapterConfig.cli?.source ?? 'managed'
      },
      cwd: ctx.cwd,
      defaultPackageName: CODEX_CLI_PACKAGE,
      defaultVersion: CODEX_CLI_VERSION,
      env: ctx.env,
      logger: ctx.logger
    })

    return {
      adapter: 'codex',
      target: 'cli',
      title: 'Codex CLI',
      binaryPath
    }
  }
})
