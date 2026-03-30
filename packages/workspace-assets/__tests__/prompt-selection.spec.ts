import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolvePromptAssetSelection, resolveWorkspaceAssetBundle } from '#~/index.js'

import { createWorkspace, writeDocument } from './test-helpers'

describe('resolvePromptAssetSelection', () => {
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
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: false
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
        'spec:.ai/specs/release.md'
      ])
    )
  })
})
