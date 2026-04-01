import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildAdapterAssetPlan, resolvePromptAssetSelection, resolveWorkspaceAssetBundle } from '#~/index.js'

import { createWorkspace, installPluginPackage, writeDocument } from './test-helpers'

describe('buildAdapterAssetPlan', () => {
  it('builds codex diagnostics for prompt, mcp, hook plugins, and unsupported opencode assets', async () => {
    const workspace = await createWorkspace()

    await installPluginPackage(workspace, '@vibe-forge/plugin-logger', {
      'package.json': JSON.stringify({
        name: '@vibe-forge/plugin-logger',
        version: '1.0.0'
      }, null, 2)
    })
    await installPluginPackage(workspace, '@vibe-forge/plugin-demo', {
      'package.json': JSON.stringify({
        name: '@vibe-forge/plugin-demo',
        version: '1.0.0'
      }, null, 2),
      'opencode/commands/review.md': '# review\n'
    })
    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        plugins: [
          { id: 'logger' },
          { id: 'demo', scope: 'demo' }
        ],
        mcpServers: {
          docs: {
            command: 'npx',
            args: ['docs-server']
          }
        }
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })
    const researchSkillId = bundle.skills.find(asset => asset.name === 'research')?.id
    const loggerHookPluginId = bundle.hookPlugins.find(asset => asset.packageId === '@vibe-forge/plugin-logger')?.id
    const demoCommandId = bundle.opencodeOverlayAssets.find(asset => asset.kind === 'command')?.id
    const docsMcpId = bundle.mcpServers.docs?.id
    expect(researchSkillId).toBeDefined()
    expect(loggerHookPluginId).toBeDefined()
    expect(demoCommandId).toBeDefined()
    expect(docsMcpId).toBeDefined()

    const [, resolvedOptions] = await resolvePromptAssetSelection({
      bundle,
      type: undefined,
      name: undefined,
      input: {
        skills: {
          include: ['research']
        }
      }
    })
    const plan = buildAdapterAssetPlan({
      adapter: 'codex',
      bundle,
      options: {
        promptAssetIds: resolvedOptions.promptAssetIds,
        mcpServers: resolvedOptions.mcpServers,
        skills: {
          include: ['research']
        }
      }
    })

    expect(plan.mcpServers).toHaveProperty('docs')
    expect(plan.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        assetId: researchSkillId,
        adapter: 'codex',
        status: 'prompt'
      }),
      expect.objectContaining({
        adapter: 'codex',
        status: 'native',
        assetId: loggerHookPluginId
      }),
      expect.objectContaining({
        adapter: 'codex',
        status: 'translated',
        assetId: docsMcpId
      }),
      expect.objectContaining({
        adapter: 'codex',
        status: 'skipped',
        assetId: demoCommandId
      })
    ]))
  })

  it('builds opencode overlays for skills and native commands', async () => {
    const workspace = await createWorkspace()

    await installPluginPackage(workspace, '@vibe-forge/plugin-demo', {
      'package.json': JSON.stringify({
        name: '@vibe-forge/plugin-demo',
        version: '1.0.0'
      }, null, 2),
      'opencode/commands/review.md': '# review\n'
    })
    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        plugins: [
          { id: 'demo', scope: 'demo' }
        ]
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })
    const plan = buildAdapterAssetPlan({
      adapter: 'opencode',
      bundle,
      options: {
        skills: {
          include: ['research']
        }
      }
    })
    const commandAsset = bundle.opencodeOverlayAssets.find(asset => asset.kind === 'command')

    expect(plan.overlays).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'skill',
        targetPath: 'skills/research'
      }),
      expect.objectContaining({
        kind: 'command',
        targetPath: 'commands/review.md'
      })
    ]))
    expect(plan.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        assetId: commandAsset?.id,
        adapter: 'opencode',
        status: 'native'
      })
    ]))
  })
})
