import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildAdapterAssetPlan, resolvePromptAssetSelection, resolveWorkspaceAssetBundle } from '#~/index.js'

import { createWorkspace, writeDocument } from './test-helpers'

describe('buildAdapterAssetPlan', () => {
  it('builds codex diagnostics for prompt, mcp, native hooks, and unsupported claude native plugins', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai.config.json'),
      JSON.stringify({
        plugins: {
          logger: {}
        },
        enabledPlugins: {
          logger: true
        },
        mcpServers: {
          docs: {
            command: 'npx',
            args: ['docs-server']
          }
        }
      })
    )
    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [{
        plugins: {
          logger: {}
        },
        enabledPlugins: {
          logger: true
        },
        mcpServers: {
          docs: {
            command: 'npx',
            args: ['docs-server']
          }
        }
      }, undefined],
      useDefaultVibeForgeMcpServer: false
    })
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
    expect(plan.native.codexHooks?.supportedEvents).toEqual([
      'SessionStart',
      'UserPromptSubmit',
      'PreToolUse',
      'PostToolUse',
      'Stop'
    ])
    expect(plan.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        adapter: 'codex',
        status: 'prompt'
      }),
      expect.objectContaining({
        adapter: 'codex',
        status: 'native',
        assetId: 'hookPlugin:project:logger'
      }),
      expect.objectContaining({
        adapter: 'codex',
        status: 'translated',
        assetId: 'mcpServer:project:docs'
      }),
      expect.objectContaining({
        adapter: 'codex',
        status: 'skipped',
        assetId: 'nativePlugin:claude-code:logger'
      })
    ]))
  })

  it('builds opencode overlays for skills and native commands', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/opencode/commands/review.md'),
      '# review'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
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
  })
})
