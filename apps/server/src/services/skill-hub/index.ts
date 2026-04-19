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
import { VERCEL_SKILLS_REGISTRY_ID, installVercelSkill, searchVercelSkills } from './vercel-skills'

export type { SkillHubInstallResult, SkillHubItem, SkillHubRegistrySummary, SkillHubSearchResult } from './types'

const ALL_REGISTRIES = 'all'

export const searchSkillHub = async (params: {
  limit?: number
  query?: string
  registry?: string
} = {}): Promise<SkillHubSearchResult> => {
  const { workspaceFolder, mergedConfig } = await loadConfigState()
  const registries = toRegistries(mergedConfig.marketplaces)
    .filter(registry => registry.id !== VERCEL_SKILLS_REGISTRY_ID)
  const includeVercelSkills = mergedConfig.marketplaces?.[VERCEL_SKILLS_REGISTRY_ID]?.enabled !== false
  const allRegistries = [
    ...(includeVercelSkills ? [VERCEL_SKILLS_REGISTRY_ID] : []),
    ...registries.map(registry => registry.id)
  ]
  const registryFilter = params.registry?.trim() || ALL_REGISTRIES
  const targetRegistries = registryFilter === ALL_REGISTRIES
    ? registries
    : registries.filter(registry => registry.id === registryFilter)
  const installs = await listManagedPluginInstalls(workspaceFolder, { adapter: 'claude' })
  const tempDir = await mkdtemp(join(tmpdir(), 'vf-skill-hub-'))
  const summaries = new Map<string, SkillHubSearchResult['registries'][number]>()
  if (includeVercelSkills) {
    summaries.set(VERCEL_SKILLS_REGISTRY_ID, {
      id: VERCEL_SKILLS_REGISTRY_ID,
      type: 'skills-sh',
      enabled: true,
      searchable: true,
      source: 'https://skills.sh'
    })
  }
  for (const registry of registries) {
    summaries.set(registry.id, { ...registry })
  }
  const items: SkillHubSearchResult['items'] = []
  let hasMore = false

  try {
    if (includeVercelSkills && (registryFilter === ALL_REGISTRIES || registryFilter === VERCEL_SKILLS_REGISTRY_ID)) {
      const result = await searchVercelSkills({ limit: params.limit, query: params.query, workspaceFolder })
      summaries.set(VERCEL_SKILLS_REGISTRY_ID, result.registry)
      hasMore = hasMore || result.hasMore
      items.push(...result.items)
    }

    if (registryFilter !== ALL_REGISTRIES && !allRegistries.includes(registryFilter)) {
      summaries.set(registryFilter, {
        id: registryFilter,
        type: 'claude-code',
        enabled: false,
        searchable: false,
        source: '',
        error: 'Registry was not found.'
      })
    }

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
    ...(hasMore ? { hasMore } : {}),
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

  if (registry === VERCEL_SKILLS_REGISTRY_ID) {
    if (mergedConfig.marketplaces?.[VERCEL_SKILLS_REGISTRY_ID]?.enabled === false) {
      throw new Error(`Skill registry "${registry}" is disabled.`)
    }
    return installVercelSkill({
      workspaceFolder,
      plugin,
      force: params.force
    })
  }

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
