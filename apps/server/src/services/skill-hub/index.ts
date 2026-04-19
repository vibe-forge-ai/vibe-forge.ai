import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { claudeCodePluginInstaller, loadMarketplaceCatalogFromSource } from '@vibe-forge/adapter-claude-code/plugins'
import { installAdapterPluginWithInstaller, installManagedPluginSource } from '@vibe-forge/managed-plugins'
import { listManagedPluginInstalls } from '@vibe-forge/utils/managed-plugin'

import { loadConfigState } from '#~/services/config/index.js'

import {
  createRegistryTempPath,
  isClaudeMarketplace,
  matchesQuery,
  toErrorMessage,
  toHubItem,
  toRegistries
} from './helpers'
import type { SkillHubInstallResult, SkillHubSearchResult } from './types'

export type { SkillHubInstallResult, SkillHubItem, SkillHubRegistrySummary, SkillHubSearchResult } from './types'

const ALL_REGISTRIES = 'all'

export const searchSkillHub = async (params: {
  query?: string
  registry?: string
} = {}): Promise<SkillHubSearchResult> => {
  const { workspaceFolder, mergedConfig } = await loadConfigState()
  const registries = toRegistries(mergedConfig.marketplaces)
  const registryFilter = params.registry?.trim() || ALL_REGISTRIES
  const targetRegistries = registryFilter === ALL_REGISTRIES
    ? registries
    : registries.filter(registry => registry.id === registryFilter)
  const installs = await listManagedPluginInstalls(workspaceFolder, { adapter: 'claude' })
  const tempDir = await mkdtemp(join(tmpdir(), 'vf-skill-hub-'))
  const summaries = new Map(registries.map(registry => [registry.id, { ...registry }]))
  const items: SkillHubSearchResult['items'] = []

  try {
    for (const registry of targetRegistries) {
      const configuredMarketplace = mergedConfig.marketplaces?.[registry.id]
      if (!isClaudeMarketplace(configuredMarketplace) || configuredMarketplace.options?.source == null) {
        summaries.set(registry.id, {
          ...registry,
          searchable: false,
          error: 'Registry source is missing.'
        })
        continue
      }

      if (configuredMarketplace.enabled === false) {
        summaries.set(registry.id, {
          ...registry,
          searchable: false,
          error: 'Registry is disabled.'
        })
        continue
      }

      try {
        const { catalog } = await loadMarketplaceCatalogFromSource(
          createRegistryTempPath(tempDir, registry.id),
          configuredMarketplace.options.source,
          registry.id,
          (targetDir, source) => installManagedPluginSource(targetDir, workspaceFolder, source)
        )
        summaries.set(registry.id, {
          ...registry,
          pluginCount: catalog.plugins.length
        })
        items.push(
          ...catalog.plugins
            .map(plugin => toHubItem(plugin, registry.id, installs))
            .filter(item => matchesQuery(item, params.query ?? ''))
        )
      } catch (error) {
        summaries.set(registry.id, {
          ...registry,
          error: toErrorMessage(error)
        })
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }

  return {
    registries: [...summaries.values()],
    items: items.sort((left, right) => (
      left.registry.localeCompare(right.registry) || left.name.localeCompare(right.name)
    ))
  }
}

export const installSkillHubPlugin = async (params: {
  registry: string
  plugin: string
  force?: boolean
  scope?: string
}): Promise<SkillHubInstallResult> => {
  const registry = params.registry.trim()
  const plugin = params.plugin.trim()
  const { workspaceFolder, mergedConfig } = await loadConfigState()
  const configuredMarketplace = mergedConfig.marketplaces?.[registry]

  if (!isClaudeMarketplace(configuredMarketplace)) {
    throw new Error(`Skill registry "${registry}" was not found.`)
  }
  if (configuredMarketplace.enabled === false) {
    throw new Error(`Skill registry "${registry}" is disabled.`)
  }
  if (configuredMarketplace.options?.source == null) {
    throw new Error(`Skill registry "${registry}" is missing options.source.`)
  }

  const result = await installAdapterPluginWithInstaller(claudeCodePluginInstaller, {
    cwd: workspaceFolder,
    source: `${plugin}@${registry}`,
    force: params.force === true,
    silent: true,
    ...(params.scope?.trim() ? { scope: params.scope.trim() } : {})
  })

  return {
    registry,
    plugin,
    name: result.config.name,
    ...(result.config.scope != null ? { scope: result.config.scope } : {}),
    installedAt: result.config.installedAt,
    installDir: result.installDir
  }
}
