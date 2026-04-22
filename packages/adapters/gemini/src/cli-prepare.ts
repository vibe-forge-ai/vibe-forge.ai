import { defineAdapterCliPreparer } from '@vibe-forge/types'
import { ensureManagedNpmCli } from '@vibe-forge/utils/managed-npm-cli'

import { GEMINI_CLI_PACKAGE, GEMINI_CLI_VERSION, resolveGeminiBinaryPath } from '#~/paths.js'
import { resolveGeminiAdapterConfig } from '#~/runtime/shared.js'

export default defineAdapterCliPreparer({
  adapter: 'gemini',
  title: 'Gemini',
  targets: [{
    key: 'cli',
    title: 'Gemini CLI',
    aliases: ['gemini'],
    configPath: ['cli']
  }],
  prepare: async (ctx) => {
    const adapterConfig = resolveGeminiAdapterConfig(ctx as Parameters<typeof resolveGeminiAdapterConfig>[0])
    const binaryPath = await ensureManagedNpmCli({
      adapterKey: 'gemini',
      binaryName: 'gemini',
      bundledPath: resolveGeminiBinaryPath(ctx.env, ctx.cwd),
      config: {
        ...adapterConfig.cli,
        source: adapterConfig.cli?.source ?? 'managed'
      },
      cwd: ctx.cwd,
      defaultPackageName: GEMINI_CLI_PACKAGE,
      defaultVersion: GEMINI_CLI_VERSION,
      env: ctx.env,
      logger: ctx.logger
    })

    return {
      adapter: 'gemini',
      target: 'cli',
      title: 'Gemini CLI',
      binaryPath
    }
  }
})
