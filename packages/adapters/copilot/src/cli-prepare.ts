import { defineAdapterCliPreparer } from '@vibe-forge/types'
import { ensureManagedNpmCli } from '@vibe-forge/utils/managed-npm-cli'

import { COPILOT_CLI_PACKAGE, COPILOT_CLI_VERSION, resolveCopilotBinaryPath } from '#~/paths.js'
import { resolveAdapterConfig } from '#~/runtime/shared.js'

export default defineAdapterCliPreparer({
  adapter: 'copilot',
  title: 'GitHub Copilot',
  targets: [{
    key: 'cli',
    title: 'GitHub Copilot CLI',
    aliases: ['copilot'],
    configPath: ['cli']
  }],
  prepare: async (ctx) => {
    const adapterConfig = resolveAdapterConfig(ctx as Parameters<typeof resolveAdapterConfig>[0])
    const binaryPath = await ensureManagedNpmCli({
      adapterKey: 'copilot',
      binaryName: 'copilot',
      bundledPath: resolveCopilotBinaryPath(ctx.env, adapterConfig.cliPath, ctx.cwd, adapterConfig.cli),
      config: {
        ...adapterConfig.cli,
        source: adapterConfig.cli?.source ?? 'managed'
      },
      configuredPath: adapterConfig.cliPath,
      cwd: ctx.cwd,
      defaultPackageName: COPILOT_CLI_PACKAGE,
      defaultVersion: COPILOT_CLI_VERSION,
      env: ctx.env,
      logger: ctx.logger
    })

    return {
      adapter: 'copilot',
      target: 'cli',
      title: 'GitHub Copilot CLI',
      binaryPath
    }
  }
})
