import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { syncConfiguredMarketplacePlugins } from '#~/managed-plugin-install.js'
import { convertClaudePluginToVibeForge } from '../../adapters/claude-code/src/plugins/convert'
import {
  detectClaudePluginRoot,
  mergeClaudePluginManifest,
  parseClaudePluginManifest
} from '../../adapters/claude-code/src/plugins/source'

const { loadAdapterPluginInstallerMock } = vi.hoisted(() => ({
  loadAdapterPluginInstallerMock: vi.fn()
}))

vi.mock('@vibe-forge/types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vibe-forge/types')>()
  return {
    ...actual,
    loadAdapterPluginInstaller: loadAdapterPluginInstallerMock
  }
})

const tempDirs: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  loadAdapterPluginInstallerMock.mockReset()
})

const createMarketplaceWorkspace = async (options?: {
  syncOnRun?: boolean
}) => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'vf-marketplace-sync-'))
  tempDirs.push(workspace)

  const marketplaceDir = path.join(workspace, 'team-marketplace')
  const pluginSourceDir = path.join(marketplaceDir, 'plugins', 'reviewer')

  await mkdir(path.join(marketplaceDir, '.claude-plugin'), { recursive: true })
  await mkdir(path.join(pluginSourceDir, '.claude-plugin'), { recursive: true })
  await mkdir(path.join(pluginSourceDir, 'commands'), { recursive: true })

  await writeFile(
    path.join(workspace, '.ai.config.yaml'),
    [
      'marketplaces:',
      '  team-tools:',
      '    type: claude-code',
      `    syncOnRun: ${options?.syncOnRun === true ? 'true' : 'false'}`,
      '    plugins:',
      '      reviewer:',
      '        scope: review',
      '    options:',
      '      source:',
      '        source: directory',
      `        path: ${JSON.stringify(marketplaceDir)}`
    ].join('\n')
  )
  await writeFile(
    path.join(marketplaceDir, '.claude-plugin', 'marketplace.json'),
    JSON.stringify(
      {
        metadata: {
          pluginRoot: './plugins'
        },
        plugins: [
          {
            name: 'reviewer',
            source: 'reviewer'
          }
        ]
      },
      null,
      2
    )
  )
  await writeFile(
    path.join(pluginSourceDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'reviewer' }, null, 2)
  )
  await writeFile(path.join(pluginSourceDir, 'commands', 'review.md'), 'Review from marketplace v1\n')

  return {
    workspace,
    marketplaceDir,
    pluginSourceDir
  }
}

describe('syncConfiguredMarketplacePlugins', () => {
  const mockInstaller = {
    adapter: 'claude',
    displayName: 'Claude',
    resolveSource: async (context: { cwd: string; requestedSource: string }) => {
      const separatorIndex = context.requestedSource.lastIndexOf('@')
      const pluginName = context.requestedSource.slice(0, separatorIndex)
      const marketplaceName = context.requestedSource.slice(separatorIndex + 1)
      return {
        installSource: {
          type: 'path' as const,
          path: path.join(context.cwd, 'team-marketplace', 'plugins', pluginName)
        },
        managedSource: {
          type: 'marketplace' as const,
          marketplace: marketplaceName,
          plugin: pluginName
        }
      }
    },
    detectPluginRoot: detectClaudePluginRoot,
    readManifest: parseClaudePluginManifest,
    mergeManifest: mergeClaudePluginManifest,
    convertToVibeForge: convertClaudePluginToVibeForge
  }

  it('installs declared marketplace plugins into .ai/plugins when missing', async () => {
    const { workspace } = await createMarketplaceWorkspace()
    loadAdapterPluginInstallerMock.mockResolvedValue(mockInstaller)

    const results = await syncConfiguredMarketplacePlugins({
      cwd: workspace,
      marketplaces: {
        'team-tools': {
          type: 'claude-code',
          syncOnRun: false,
          plugins: {
            reviewer: {
              scope: 'review'
            }
          }
        }
      }
    })

    expect(results).toEqual([
      {
        marketplace: 'team-tools',
        plugin: 'reviewer',
        action: 'installed'
      }
    ])
    await expect(
      readFile(path.join(workspace, '.ai/plugins/reviewer/vibe-forge/skills/review/SKILL.md'), 'utf8')
    ).resolves.toContain('Review from marketplace v1')
    await expect(
      readFile(path.join(workspace, '.ai/plugins/reviewer/.vf-plugin.json'), 'utf8')
    ).resolves.toContain('"scope": "review"')
  })

  it('updates declared marketplace plugins on run when syncOnRun is enabled', async () => {
    const { workspace, pluginSourceDir } = await createMarketplaceWorkspace({ syncOnRun: true })
    loadAdapterPluginInstallerMock.mockResolvedValue(mockInstaller)

    await syncConfiguredMarketplacePlugins({
      cwd: workspace,
      marketplaces: {
        'team-tools': {
          type: 'claude-code',
          syncOnRun: true,
          plugins: {
            reviewer: {
              scope: 'review'
            }
          }
        }
      }
    })
    await writeFile(path.join(pluginSourceDir, 'commands', 'review.md'), 'Review from marketplace v2\n')

    const results = await syncConfiguredMarketplacePlugins({
      cwd: workspace,
      marketplaces: {
        'team-tools': {
          type: 'claude-code',
          syncOnRun: true,
          plugins: {
            reviewer: {
              scope: 'review'
            }
          }
        }
      }
    })

    expect(results.at(-1)).toEqual({
      marketplace: 'team-tools',
      plugin: 'reviewer',
      action: 'updated'
    })
    await expect(
      readFile(path.join(workspace, '.ai/plugins/reviewer/vibe-forge/skills/review/SKILL.md'), 'utf8')
    ).resolves.toContain('Review from marketplace v2')
  })
})
