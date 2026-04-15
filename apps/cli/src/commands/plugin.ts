import process from 'node:process'

import { buildConfigJsonVariables, loadConfig, mergeConfigs } from '@vibe-forge/config'
import type { Command } from 'commander'

import { createAdapterOption, normalizeCliAdapterOptionValue } from './@core/adapter-option'
import { addAdapterPlugin } from './@core/plugin-install'

const normalizeManagedPluginAdapter = (adapter: string) => adapter === 'claude-code' ? 'claude' : adapter

export const resolvePluginCommandAdapter = async (
  explicitAdapter: string | undefined,
  cwd: string = process.cwd()
) => {
  const normalizedExplicitAdapter = explicitAdapter == null
    ? undefined
    : normalizeCliAdapterOptionValue(explicitAdapter)
  if (normalizedExplicitAdapter) return normalizeManagedPluginAdapter(normalizedExplicitAdapter)

  const [projectConfig, userConfig] = await loadConfig({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd, process.env)
  })
  return normalizeManagedPluginAdapter(
    mergeConfigs(projectConfig, userConfig)?.defaultAdapter ?? 'claude'
  )
}

export function registerPluginCommand(program: Command) {
  const pluginCommand = program
    .command('plugin')
    .description('Install and manage adapter-native plugins')
    .addOption(createAdapterOption('Plugin adapter type'))

  pluginCommand
    .command('add <source>')
    .description('Install an adapter-native plugin from local sources, package registries, or configured marketplaces')
    .option('--force', 'Replace the existing installed plugin if it already exists', false)
    .option('--scope <scope>', 'Override the Vibe Forge scope used for converted assets')
    .action(async (source: string, opts: { force?: boolean; scope?: string }, command: Command) => {
      try {
        const parentOptions = command.parent?.opts() as { adapter?: string } | undefined
        const adapter = await resolvePluginCommandAdapter(parentOptions?.adapter)
        await addAdapterPlugin(adapter, {
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
