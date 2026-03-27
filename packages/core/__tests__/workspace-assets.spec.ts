import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { buildAdapterAssetPlan, resolvePromptAssetSelection, resolveWorkspaceAssetBundle } from '#~/utils/workspace-assets.js'

const tempDirs: string[] = []

const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workspace-assets-'))
  tempDirs.push(dir)
  return dir
}

const writeDocument = async (filePath: string, content: string) => {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content)
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('workspace assets', () => {
  it('prefers project prompt assets over plugin assets with the same identifier', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/specs/release.md'),
      '---\ndescription: 项目发布流程\n---\n执行项目发布'
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/specs/release/index.md'),
      '---\ndescription: 插件发布流程\n---\n执行插件发布'
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined]
    })
    const [data, resolvedOptions] = await resolvePromptAssetSelection({
      bundle,
      type: 'spec',
      name: 'release'
    })

    expect(data.targetBody).toContain('执行项目发布')
    expect(data.targetBody).not.toContain('执行插件发布')
    expect(data.specs).toHaveLength(1)
    expect(resolvedOptions.systemPrompt).toContain('项目发布流程')
    expect(resolvedOptions.systemPrompt).not.toContain('插件发布流程')
    expect(resolvedOptions.promptAssetIds).toEqual(
      expect.arrayContaining([
        `spec:.ai/specs/release.md`
      ])
    )
  })

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
      }, undefined]
    })

    expect(bundle.skills).toHaveLength(0)
    expect(bundle.rules).toHaveLength(0)
    expect(Object.keys(bundle.mcpServers)).toHaveLength(0)
    expect(bundle.hookPlugins).toHaveLength(0)
    expect(bundle.assets.some(asset => asset.pluginId === 'demo' && asset.enabled)).toBe(false)
  })

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
      }, undefined]
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
      configs: [undefined, undefined]
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
