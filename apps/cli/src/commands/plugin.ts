import process from 'node:process'

import type { Command } from 'commander'

import { installClaudePlugin, normalizePluginAdapter } from './plugin-install'

export { installClaudePlugin } from './plugin-install'

export function registerPluginCommand(program: Command) {
  const pluginCommand = program
    .command('plugin')
    .description('Install and manage adapter-native plugins')
    .option('--adapter <adapter>', 'Plugin adapter type', 'claude')

  pluginCommand
    .command('add <source>')
    .description('Install a Claude plugin from npm, GitHub, git, or a local path into .ai/plugins')
    .option('--force', 'Replace the existing installed plugin if it already exists', false)
    .option('--scope <scope>', 'Override the Vibe Forge scope used for converted assets')
    .action(async (source: string, opts: { force?: boolean; scope?: string }, command: Command) => {
      try {
        const parentOptions = command.parent?.opts() as { adapter?: string } | undefined
        const adapter = normalizePluginAdapter(parentOptions?.adapter)
        if (adapter !== 'claude') {
          throw new Error(`Unsupported plugin adapter: ${adapter}`)
        }

        await installClaudePlugin({
          source,
          force: opts.force,
          scope: opts.scope
        })
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })
}
