import fs from 'node:fs/promises'
import path from 'node:path'

import type {
  ClaudeCodeMarketplacePluginDefinition,
  ClaudeCodeMarketplaceSource,
  ManagedPluginSource,
  MarketplaceConfig
} from '@vibe-forge/types'
import { normalizeMarketplaceConfig } from '@vibe-forge/utils'

import { pathExists } from './source'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

export interface ClaudeMarketplaceCatalog {
  name?: string
  metadata?: {
    pluginRoot?: string
  }
  plugins: ClaudeCodeMarketplacePluginDefinition[]
}

const normalizeMarketplaceCatalog = (catalog: unknown, description: string): ClaudeMarketplaceCatalog => {
  const catalogSource: Record<string, unknown> = {
    source: 'settings',
    ...(isRecord(catalog) ? catalog : {})
  }
  if (isRecord(catalog) && 'plugins' in catalog) {
    catalogSource.plugins = catalog.plugins
  }

  const normalized = normalizeMarketplaceConfig({
    __catalog__: {
      type: 'claude-code',
      options: {
        source: catalogSource
      }
    }
  } as unknown as MarketplaceConfig, description, {
    allowSettingsPathPluginSources: true
  })

  const source = normalized?.__catalog__?.options?.source
  if (source == null || source.source !== 'settings') {
    throw new TypeError(`Failed to normalize Claude marketplace catalog from ${description}.`)
  }

  return {
    ...(source.name != null ? { name: source.name } : {}),
    ...(source.metadata != null ? { metadata: source.metadata } : {}),
    plugins: source.plugins
  }
}

const readMarketplaceCatalogFromRoot = async (rootDir: string): Promise<ClaudeMarketplaceCatalog> => {
  const catalogPath = path.join(rootDir, '.claude-plugin', 'marketplace.json')
  if (!await pathExists(catalogPath)) {
    throw new Error(`Claude marketplace catalog not found at ${catalogPath}.`)
  }
  return normalizeMarketplaceCatalog(JSON.parse(await fs.readFile(catalogPath, 'utf8')) as unknown, catalogPath)
}

const resolvePathWithinRoot = (rootDir: string, candidatePath: string, description: string) => {
  const resolvedPath = path.resolve(rootDir, candidatePath)
  const relativePath = path.relative(rootDir, resolvedPath)
  if (
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    relativePath.startsWith('..\\') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`${description} resolves outside the marketplace root.`)
  }
  return resolvedPath
}

export const loadMarketplaceCatalogFromSource = async (
  tempDir: string,
  source: ClaudeCodeMarketplaceSource,
  marketplaceName: string,
  installSource: (targetDir: string, source: ManagedPluginSource) => Promise<string>
): Promise<{ catalog: ClaudeMarketplaceCatalog; rootDir?: string }> => {
  switch (source.source) {
    case 'settings':
      return {
        catalog: {
          ...(source.name != null ? { name: source.name } : {}),
          ...(source.metadata != null ? { metadata: source.metadata } : {}),
          plugins: source.plugins
        }
      }
    case 'url': {
      const response = await fetch(source.url)
      if (!response.ok) {
        throw new Error(`Failed to fetch Claude marketplace ${marketplaceName} from ${source.url}: ${response.status}.`)
      }
      return {
        catalog: normalizeMarketplaceCatalog(await response.json(), source.url)
      }
    }
    case 'directory':
    case 'github':
    case 'git': {
      const sourceRoot = await installSource(
        path.join(tempDir, 'marketplace-source'),
        source.source === 'directory'
          ? { type: 'path', path: source.path }
          : source.source === 'github'
          ? { type: 'github', repo: source.repo, ...(source.ref != null ? { ref: source.ref } : {}) }
          : { type: 'git', url: source.url, ...(source.ref != null ? { ref: source.ref } : {}) }
      )

      const marketplaceRoot = source.source === 'directory'
        ? sourceRoot
        : source.path != null
        ? resolvePathWithinRoot(sourceRoot, source.path, `Marketplace ${marketplaceName} path`)
        : sourceRoot

      return {
        rootDir: marketplaceRoot,
        catalog: await readMarketplaceCatalogFromRoot(marketplaceRoot)
      }
    }
    case 'hostPattern':
      throw new Error(
        `Configured Claude marketplace ${marketplaceName} uses hostPattern restrictions and cannot be fetched directly.`
      )
  }
}
