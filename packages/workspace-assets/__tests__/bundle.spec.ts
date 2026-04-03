import process from 'node:process'

import { describe, expect, it } from 'vitest'

import { resolveWorkspaceAssetBundle } from '#~/index.js'

import { createWorkspace, installPluginPackage } from './test-helpers'

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

  it('adds the built-in Vibe Forge MCP server when enabled and omits it when disabled', async () => {
    const workspace = await createWorkspace()

    const enabledBundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: true
    })

    expect(enabledBundle.mcpServers).toHaveProperty('vibe-forge')
    expect(enabledBundle.mcpServers['vibe-forge']?.payload.config).toEqual(expect.objectContaining({
      command: process.execPath,
      args: [expect.stringMatching(/packages\/mcp\/cli\.js$/)]
    }))

    const disabledBundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(disabledBundle.mcpServers).not.toHaveProperty('vibe-forge')
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
