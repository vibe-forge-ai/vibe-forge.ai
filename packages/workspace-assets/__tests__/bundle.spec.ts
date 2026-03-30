import { join } from 'node:path'
import process from 'node:process'

import { describe, expect, it } from 'vitest'

import { resolveWorkspaceAssetBundle } from '#~/index.js'

import { createWorkspace, writeDocument } from './test-helpers'

describe('resolveWorkspaceAssetBundle', () => {
  it('treats enabledPlugins as a global asset switch', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai.config.json'),
      JSON.stringify({
        plugins: {
          logger: {}
        },
        enabledPlugins: {
          logger: false,
          demo: false
        }
      })
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/rules/review.md'),
      '---\ndescription: 评审规则\n---\n必须检查风险'
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/mcp/browser.json'),
      JSON.stringify({ command: 'npx', args: ['browser-server'] })
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/opencode/commands/review.md'),
      '# review'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        plugins: {
          logger: {}
        },
        enabledPlugins: {
          logger: false,
          demo: false
        }
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })

    expect(bundle.skills).toHaveLength(0)
    expect(bundle.rules).toHaveLength(0)
    expect(Object.keys(bundle.mcpServers)).toHaveLength(0)
    expect(bundle.hookPlugins).toHaveLength(0)
    expect(bundle.assets.some((asset: (typeof bundle.assets)[number]) => asset.pluginId === 'demo' && asset.enabled))
      .toBe(false)
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
})
