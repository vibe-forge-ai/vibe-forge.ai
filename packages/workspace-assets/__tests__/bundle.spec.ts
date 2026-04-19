import { join } from 'node:path'
import process from 'node:process'

import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildAdapterAssetPlan, resolveWorkspaceAssetBundle } from '#~/index.js'

import { createWorkspace, installPluginPackage, writeDocument } from './test-helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveWorkspaceAssetBundle', () => {
  it('loads npm plugin assets via the package-id fallback and exposes OpenCode overlays', async () => {
    const workspace = await createWorkspace()

    await installPluginPackage(workspace, '@vibe-forge/plugin-demo', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-demo',
          version: '1.0.0'
        },
        null,
        2
      ),
      'skills/research/SKILL.md': '---\ndescription: 检索资料\n---\n阅读 README.md',
      'rules/review.md': '---\ndescription: 评审规则\n---\n必须检查风险',
      'mcp/browser.json': JSON.stringify({ command: 'npx', args: ['browser-server'] }, null, 2),
      'opencode/commands/review.md': '# review\n'
    })
    await installPluginPackage(workspace, '@vibe-forge/plugin-logger', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-logger',
          version: '1.0.0'
        },
        null,
        2
      ),
      'hooks.js': 'module.exports = {}\n'
    })

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        plugins: [
          { id: 'demo', scope: 'demo' },
          { id: 'logger' }
        ]
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills.map(asset => asset.displayName)).toEqual(['demo/research'])
    expect(bundle.rules.map(asset => asset.displayName)).toEqual(['demo/review'])
    expect(Object.keys(bundle.mcpServers)).toEqual(['demo/browser'])
    expect(bundle.hookPlugins).toEqual(expect.arrayContaining([
      expect.objectContaining({
        packageId: '@vibe-forge/plugin-logger'
      })
    ]))
    expect(bundle.hookPlugins).toHaveLength(1)
    expect(bundle.opencodeOverlayAssets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'command',
        sourcePath: expect.stringContaining('/node_modules/@vibe-forge/plugin-demo/opencode/commands/review.md'),
        payload: expect.objectContaining({
          targetSubpath: 'commands/review.md'
        })
      })
    ]))
  })

  it('loads workspace assets from the env-configured ai base dir', async () => {
    const workspace = await createWorkspace()
    const previousBaseDir = process.env.__VF_PROJECT_AI_BASE_DIR__

    try {
      process.env.__VF_PROJECT_AI_BASE_DIR__ = '.vf'
      await writeDocument(join(workspace, '.vf/rules/review.md'), '---\ndescription: 评审规则\n---\n必须检查风险')
      await writeDocument(
        join(workspace, '.vf/skills/research/SKILL.md'),
        '---\ndescription: 检索资料\n---\n阅读 README.md'
      )

      const bundle = await resolveWorkspaceAssetBundle({
        cwd: workspace,
        configs: [undefined, undefined],
        useDefaultVibeForgeMcpServer: false
      })

      expect(bundle.rules.map(asset => asset.displayName)).toEqual(['review'])
      expect(bundle.skills.map(asset => asset.displayName)).toEqual(['research'])
    } finally {
      if (previousBaseDir == null) {
        delete process.env.__VF_PROJECT_AI_BASE_DIR__
      } else {
        process.env.__VF_PROJECT_AI_BASE_DIR__ = previousBaseDir
      }
    }
  })

  it('installs selected missing skill dependencies from an API-compatible registry cache', async () => {
    const workspace = await createWorkspace()
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://registry.example.test/api/search?q=frontend-design&limit=10') {
        return new Response(JSON.stringify({
          skills: [{
            id: 'anthropics/skills/frontend-design',
            skillId: 'frontend-design',
            name: 'frontend-design',
            source: 'anthropics/skills'
          }]
        }))
      }
      if (url === 'https://registry.example.test/api/download/anthropics/skills/frontend-design') {
        return new Response(JSON.stringify({
          files: [{
            path: 'SKILL.md',
            contents: '---\nname: frontend-design\ndescription: UI design guidance\n---\nUse strong visual hierarchy.\n'
          }]
        }))
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await writeDocument(
      join(workspace, '.ai/skills/app-builder/SKILL.md'),
      [
        '---',
        'name: app-builder',
        'description: Build apps',
        'dependencies:',
        '  - frontend-design',
        '---',
        'Build the app.'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        skills: {
          registry: 'https://registry.example.test'
        }
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills.map(asset => asset.name).sort()).toEqual(['app-builder'])
    expect(fetchMock).not.toHaveBeenCalled()

    await buildAdapterAssetPlan({
      adapter: 'opencode',
      bundle,
      options: {
        skills: {
          include: ['app-builder']
        }
      }
    })

    const dependency = bundle.skills.find(asset => asset.name === 'frontend-design')
    expect(bundle.skills.map(asset => asset.name).sort()).toEqual(['app-builder', 'frontend-design'])
    expect(dependency?.sourcePath).toContain('/.ai/caches/skill-dependencies/registry.example.test/')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://registry.example.test/api/search?q=frontend-design&limit=10',
      expect.any(Object)
    )
  })

  it('reuses complete skill dependency caches without deleting or downloading them again', async () => {
    const workspace = await createWorkspace()
    const fetchMock = vi.fn(async () => new Response('not found', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    const cachedSkillPath = join(
      workspace,
      '.ai/caches/skill-dependencies/registry.example.test/anthropics/skills/frontend-design/SKILL.md'
    )
    await writeDocument(
      cachedSkillPath,
      '---\nname: frontend-design\ndescription: Cached UI guidance\n---\nUse the cached copy.\n'
    )
    await writeDocument(
      join(workspace, '.ai/skills/app-builder/SKILL.md'),
      [
        '---',
        'name: app-builder',
        'description: Build apps',
        'dependencies:',
        '  - anthropics/skills@frontend-design',
        '---',
        'Build the app.'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        skills: {
          registry: 'https://registry.example.test'
        }
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    await buildAdapterAssetPlan({
      adapter: 'opencode',
      bundle,
      options: {
        skills: {
          include: ['app-builder']
        }
      }
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(await readFile(cachedSkillPath, 'utf8')).toContain('Use the cached copy.')
    expect(bundle.skills.map(asset => asset.name).sort()).toEqual(['app-builder', 'frontend-design'])
  })

  it('keeps configured registry url search and download endpoints together when env overrides exist', async () => {
    const workspace = await createWorkspace()
    const previousDownloadUrl = process.env.SKILLS_DOWNLOAD_URL
    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'https://private-registry.example.test/api/search?q=frontend-design&limit=10') {
        return new Response(JSON.stringify({
          skills: [{
            id: 'anthropics/skills/frontend-design',
            skillId: 'frontend-design',
            name: 'frontend-design',
            source: 'anthropics/skills'
          }]
        }))
      }
      if (url === 'https://private-registry.example.test/api/download/anthropics/skills/frontend-design') {
        return new Response(JSON.stringify({
          files: [{
            path: 'SKILL.md',
            contents: '---\nname: frontend-design\ndescription: UI design guidance\n---\nUse strong visual hierarchy.\n'
          }]
        }))
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      process.env.SKILLS_DOWNLOAD_URL = 'https://env-download.example.test'
      await writeDocument(
        join(workspace, '.ai/skills/app-builder/SKILL.md'),
        [
          '---',
          'name: app-builder',
          'description: Build apps',
          'dependencies:',
          '  - frontend-design',
          '---',
          'Build the app.'
        ].join('\n')
      )

      const bundle = await resolveWorkspaceAssetBundle({
        cwd: workspace,
        configs: [{
          skills: {
            registry: {
              url: 'https://private-registry.example.test'
            }
          }
        }, undefined],
        useDefaultVibeForgeMcpServer: false
      })

      await buildAdapterAssetPlan({
        adapter: 'opencode',
        bundle,
        options: {
          skills: {
            include: ['app-builder']
          }
        }
      })

      expect(fetchMock).toHaveBeenCalledWith(
        'https://private-registry.example.test/api/download/anthropics/skills/frontend-design',
        expect.any(Object)
      )
      expect(fetchMock).not.toHaveBeenCalledWith(
        'https://env-download.example.test/api/download/anthropics/skills/frontend-design',
        expect.any(Object)
      )
    } finally {
      if (previousDownloadUrl == null) {
        delete process.env.SKILLS_DOWNLOAD_URL
      } else {
        process.env.SKILLS_DOWNLOAD_URL = previousDownloadUrl
      }
    }
  })

  it('loads workspace entities from the env-configured entities dir', async () => {
    const workspace = await createWorkspace()
    const previousEntitiesDir = process.env.__VF_PROJECT_AI_ENTITIES_DIR__

    try {
      process.env.__VF_PROJECT_AI_ENTITIES_DIR__ = 'agents'
      await writeDocument(
        join(workspace, '.ai/agents/reviewer/README.md'),
        '---\ndescription: 负责代码评审\n---\n检查风险'
      )

      const bundle = await resolveWorkspaceAssetBundle({
        cwd: workspace,
        configs: [undefined, undefined],
        useDefaultVibeForgeMcpServer: false
      })

      expect(bundle.entities.map(asset => asset.displayName)).toEqual(['reviewer'])
      expect(bundle.entities[0]?.sourcePath).toContain('/.ai/agents/reviewer/README.md')
    } finally {
      if (previousEntitiesDir == null) {
        delete process.env.__VF_PROJECT_AI_ENTITIES_DIR__
      } else {
        process.env.__VF_PROJECT_AI_ENTITIES_DIR__ = previousEntitiesDir
      }
    }
  })

  it('auto-loads managed Claude plugins from .ai/plugins as directory plugins', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/plugins/demo/.vf-plugin.json'),
      JSON.stringify(
        {
          version: 1,
          adapter: 'claude',
          name: 'demo',
          scope: 'demo',
          installedAt: new Date().toISOString(),
          source: {
            type: 'path',
            path: './demo'
          },
          nativePluginPath: 'native',
          vibeForgePluginPath: 'vibe-forge'
        },
        null,
        2
      )
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/vibe-forge/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/vibe-forge/mcp/browser.json'),
      JSON.stringify({ command: 'npx', args: ['browser-server'] }, null, 2)
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/vibe-forge/hooks.js'),
      'module.exports = { name: "demo-managed" }\n'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills.map(asset => asset.displayName)).toContain('demo/research')
    expect(Object.keys(bundle.mcpServers)).toContain('demo/browser')
    expect(bundle.hookPlugins).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'demo',
        origin: 'plugin'
      })
    ]))
  })

  it('adds the built-in Vibe Forge MCP server when enabled and omits it when disabled', async () => {
    const workspace = await createWorkspace()

    const enabledBundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: true
    })

    expect(enabledBundle.mcpServers).toHaveProperty('VibeForge')
    expect(enabledBundle.mcpServers.VibeForge?.payload.config).toEqual(expect.objectContaining({
      command: process.execPath,
      args: [expect.stringMatching(/packages\/mcp\/cli\.js$/)]
    }))

    const disabledBundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(disabledBundle.mcpServers).not.toHaveProperty('VibeForge')
  })

  it('discovers configured workspaces from glob patterns and entries', async () => {
    const workspace = await createWorkspace()

    await writeDocument(join(workspace, 'services/billing/README.md'), '# billing\n')
    await writeDocument(join(workspace, 'services/legacy/README.md'), '# legacy\n')
    await writeDocument(join(workspace, 'docs/README.md'), '# docs\n')

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        workspaces: {
          include: ['services/*'],
          exclude: ['services/legacy'],
          entries: {
            docs: {
              path: 'docs',
              description: 'Documentation workspace'
            }
          }
        }
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.workspaces.map(asset => asset.displayName)).toEqual(['billing', 'docs'])
    expect(bundle.workspaces.map(asset => asset.payload)).toEqual([
      expect.objectContaining({
        id: 'billing',
        path: 'services/billing'
      }),
      expect.objectContaining({
        id: 'docs',
        path: 'docs',
        description: 'Documentation workspace'
      })
    ])
  })

  it('skips disabled plugin instances and lets disabled child overrides suppress default child activation', async () => {
    const workspace = await createWorkspace()

    await installPluginPackage(workspace, '@vibe-forge/plugin-demo', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-demo',
          version: '1.0.0'
        },
        null,
        2
      ),
      'skills/research/SKILL.md': '---\ndescription: 检索资料\n---\n阅读 README.md'
    })
    await installPluginPackage(workspace, '@vibe-forge/plugin-bundle', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-bundle',
          version: '1.0.0'
        },
        null,
        2
      ),
      'index.js': [
        'module.exports = {',
        '  __vibeForgePluginManifest: true,',
        '  children: {',
        '    review: {',
        '      source: { type: "package", id: "@vibe-forge/plugin-review" },',
        '      activation: "default"',
        '    }',
        '  }',
        '}',
        ''
      ].join('\n')
    })
    await installPluginPackage(workspace, '@vibe-forge/plugin-review', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-review',
          version: '1.0.0'
        },
        null,
        2
      ),
      'skills/audit/SKILL.md': '---\ndescription: 代码审计\n---\n检查 child plugin 是否启用'
    })

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        plugins: [
          { id: 'demo', scope: 'demo', enabled: false },
          {
            id: 'bundle',
            scope: 'bundle',
            children: [
              { id: 'review', enabled: false }
            ]
          }
        ]
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills).toEqual([])
    expect(bundle.pluginInstances.map(instance => instance.packageId)).toEqual(['@vibe-forge/plugin-bundle'])
  })

  it('lets later config layers disable matching plugin instances by id and scope', async () => {
    const workspace = await createWorkspace()

    await installPluginPackage(workspace, '@vibe-forge/plugin-logger', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-logger',
          version: '1.0.0'
        },
        null,
        2
      ),
      'hooks.js': 'module.exports = {}\n'
    })

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [
        {
          plugins: [
            { id: 'logger' }
          ]
        },
        {
          plugins: [
            { id: 'logger', enabled: false }
          ]
        }
      ],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.pluginConfigs).toEqual([
      { id: 'logger', enabled: false }
    ])
    expect(bundle.pluginInstances).toEqual([])
    expect(bundle.hookPlugins).toEqual([])
  })

  it('surfaces invalid plugin manifests instead of silently falling back to directory scanning', async () => {
    const workspace = await createWorkspace()

    await installPluginPackage(workspace, '@vibe-forge/plugin-bad-manifest', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-bad-manifest',
          version: '1.0.0',
          exports: {
            '.': './index.js'
          }
        },
        null,
        2
      ),
      'index.js': [
        'module.exports = {',
        '  __vibeForgePluginManifest: true,',
        '  scope: "bad",',
        '  assets: {',
        '    skills: "./custom-skills"',
        '  }',
        '}',
        ''
      ].join('\n'),
      'custom-skills/research/SKILL.md': '---\ndescription: 检索资料\n---\n阅读 README.md'
    })

    await expect(resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        plugins: [
          { id: '@vibe-forge/plugin-bad-manifest' }
        ]
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })).rejects.toThrow('Failed to load plugin manifest for @vibe-forge/plugin-bad-manifest')
  })
})
