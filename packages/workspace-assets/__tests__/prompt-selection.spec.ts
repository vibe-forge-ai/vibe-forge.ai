import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolvePromptAssetSelection, resolveWorkspaceAssetBundle } from '#~/index.js'

import { createWorkspace, installPluginPackage, writeDocument } from './test-helpers'

describe('resolvePromptAssetSelection', () => {
  it('selects local assets by short name and scoped plugin assets explicitly', async () => {
    const workspace = await createWorkspace()

    await installPluginPackage(workspace, '@vibe-forge/plugin-demo', {
      'package.json': JSON.stringify({
        name: '@vibe-forge/plugin-demo',
        version: '1.0.0'
      }, null, 2),
      'specs/release/index.md': '---\ndescription: 插件发布流程\n---\n执行插件发布'
    })
    await writeDocument(
      join(workspace, '.ai/specs/release.md'),
      '---\ndescription: 项目发布流程\n---\n执行项目发布'
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
    const [localData, localOptions] = await resolvePromptAssetSelection({
      bundle,
      type: 'spec',
      name: 'release'
    })
    const [pluginData, pluginOptions] = await resolvePromptAssetSelection({
      bundle,
      type: 'spec',
      name: 'demo/release'
    })
    const localSpecId = bundle.specs.find(asset => asset.origin === 'workspace' && asset.name === 'release')?.id
    const pluginSpecId = bundle.specs.find(asset => asset.origin === 'plugin' && asset.displayName === 'demo/release')?.id

    expect(localData.targetBody).toContain('执行项目发布')
    expect(localData.targetBody).not.toContain('执行插件发布')
    expect(localOptions.systemPrompt).toContain('项目发布流程')
    expect(localOptions.systemPrompt).toContain('demo/release')
    expect(localOptions.promptAssetIds).toEqual(expect.arrayContaining([localSpecId]))

    expect(pluginData.targetBody).toContain('执行插件发布')
    expect(pluginOptions.systemPrompt).toContain('插件发布流程')
    expect(pluginOptions.promptAssetIds).toEqual(expect.arrayContaining([pluginSpecId]))
  })
})
