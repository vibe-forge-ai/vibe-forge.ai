import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { Config } from '@vibe-forge/types'

import { buildAdapterAssetPlan, resolvePromptAssetSelection, resolveWorkspaceAssetBundle } from '#~/index.js'

import { serializeWorkspaceAssetsSnapshot } from './snapshot'
import { createWorkspace, installPluginPackage, writeDocument } from './test-helpers'

const resolveSnapshotPath = (name: string) => (
  fileURLToPath(new URL(`./__snapshots__/${name}.snapshot.json`, import.meta.url))
)

describe('workspace assets snapshots', () => {
  it('projects a rich workspace bundle, prompt selection, and adapter plans', async () => {
    const workspace = await createWorkspace()

    const projectConfig: Config = {
      plugins: [
        {
          id: 'logger'
        },
        {
          id: 'demo',
          scope: 'demo'
        }
      ],
      mcpServers: {
        docs: {
          command: 'npx',
          args: ['docs-server']
        }
      },
      defaultIncludeMcpServers: ['docs', 'demo/browser']
    }

    const userConfig: Config = {
      plugins: [
        {
          id: 'telemetry',
          options: {
            mode: 'summary'
          }
        }
      ],
      mcpServers: {
        notes: {
          command: 'node',
          args: ['tools/notes-mcp.js']
        }
      },
      defaultExcludeMcpServers: ['notes']
    }

    await installPluginPackage(workspace, '@vibe-forge/plugin-demo', {
      'package.json': JSON.stringify({
        name: '@vibe-forge/plugin-demo',
        version: '1.0.0'
      }, null, 2),
      'rules/security.md': [
        '---',
        'description: 插件安全规则',
        '---',
        '上线前要检查权限与密钥暴露。'
      ].join('\n'),
      'specs/release/index.md': [
        '---',
        'description: 插件发布流程',
        '---',
        '插件 release 不应直接替代项目 release。'
      ].join('\n'),
      'skills/audit/SKILL.md': [
        '---',
        'description: 审计输出',
        '---',
        '检查最终输出是否覆盖风险项。'
      ].join('\n'),
      'mcp/browser.json': JSON.stringify(
        {
          name: 'browser',
          command: 'npx',
          args: ['browser-mcp']
        },
        null,
        2
      ),
      'opencode/agents/release-helper.md': '# release-helper\n',
      'opencode/commands/review.md': '# review\n',
      'opencode/modes/strict.md': '# strict\n',
      'opencode/plugins/demo-plugin.js': 'export default {}\n'
    })
    await installPluginPackage(workspace, '@vibe-forge/plugin-logger', {
      'package.json': JSON.stringify({
        name: '@vibe-forge/plugin-logger',
        version: '1.0.0'
      }, null, 2)
    })
    await installPluginPackage(workspace, '@vibe-forge/plugin-telemetry', {
      'package.json': JSON.stringify({
        name: '@vibe-forge/plugin-telemetry',
        version: '1.0.0'
      }, null, 2)
    })

    await writeDocument(
      join(workspace, '.ai/rules/review.md'),
      [
        '---',
        'description: 项目评审规则',
        'always: true',
        '---',
        '必须检查发布改动的回归风险。'
      ].join('\n')
    )
    await writeDocument(
      join(workspace, '.ai/specs/release/index.md'),
      [
        '---',
        'description: 正式发布流程',
        'rules:',
        '  - .ai/rules/review.md',
        'skills:',
        '  - research',
        'mcpServers:',
        '  include:',
        '    - docs',
        '    - demo/browser',
        '  exclude:',
        '    - demo/browser',
        'tools:',
        '  include:',
        '    - Read',
        '    - Edit',
        '---',
        '执行正式发布，并整理变更摘要。'
      ].join('\n')
    )
    await writeDocument(
      join(workspace, '.ai/entities/architect/README.md'),
      [
        '---',
        'description: 负责拆解方案的实体',
        '---',
        '把发布任务拆解成执行步骤。'
      ].join('\n')
    )
    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      [
        '---',
        'description: 检索资料',
        '---',
        '先阅读 README.md，再补充结论。'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [projectConfig, userConfig],
      useDefaultVibeForgeMcpServer: false
    })
    const [resolution, options] = await resolvePromptAssetSelection({
      bundle,
      type: 'spec',
      name: 'release',
      input: {
        skills: {
          include: ['research']
        }
      }
    })

    const adapters = ['claude-code', 'codex', 'opencode'] as const
    const plans = adapters.map(adapter => (
      buildAdapterAssetPlan({
        adapter,
        bundle,
        options: {
          promptAssetIds: options.promptAssetIds,
          mcpServers: options.mcpServers,
          skills: {
            include: ['research']
          }
        }
      })
    ))

    await expect(serializeWorkspaceAssetsSnapshot({
      cwd: workspace,
      bundle,
      selection: {
        resolution,
        options
      },
      plans
    })).toMatchFileSnapshot(resolveSnapshotPath('workspace-assets-rich'))
  })
})
