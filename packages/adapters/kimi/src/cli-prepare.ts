import { defineAdapterCliPreparer } from '@vibe-forge/types'

import { ensureKimiCli } from '#~/runtime/init.js'

export default defineAdapterCliPreparer({
  adapter: 'kimi',
  title: 'Kimi',
  targets: [{
    key: 'cli',
    title: 'Kimi CLI',
    aliases: ['kimi'],
    configPath: ['cli']
  }],
  prepare: async (ctx) => {
    const binaryPath = await ensureKimiCli(ctx as Parameters<typeof ensureKimiCli>[0], {
      defaultSource: 'managed'
    })
    return {
      adapter: 'kimi',
      target: 'cli',
      title: 'Kimi CLI',
      binaryPath
    }
  }
})
