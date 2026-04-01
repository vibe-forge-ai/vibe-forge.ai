import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolvePromptAssetSelection, resolveWorkspaceAssetBundle } from '#~/index.js'

import { createWorkspace, installPluginPackage, writeDocument } from './test-helpers'

describe('resolvePromptAssetSelection', () => {
  it('embeds only alwaysApply rules and keeps optional rules as summaries', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/rules/base.md'),
      [
        '---',
        'alwaysApply: true',
        'description: 基础约束',
        '---',
        '始终检查公共边界。'
      ].join('\n')
    )
    await writeDocument(
      join(workspace, '.ai/rules/optional.md'),
      [
        '---',
        'alwaysApply: false',
        'description: 按需参考规则',
        '---',
        '只有在特定场景才需要展开。'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      useDefaultVibeForgeMcpServer: false
    })
    const [, options] = await resolvePromptAssetSelection({
      bundle,
      type: undefined
    })

    expect(options.systemPrompt).toContain('# base')
    expect(options.systemPrompt).toContain('> 始终检查公共边界。')
    expect(options.systemPrompt).toContain('# optional')
    expect(options.systemPrompt).toContain('> 按需参考规则')
    expect(options.systemPrompt).not.toContain('只有在特定场景才需要展开。')
  })

  it('selects local assets by short name and scoped plugin assets explicitly', async () => {
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
    const pluginSpecId = bundle.specs.find(asset => asset.origin === 'plugin' && asset.displayName === 'demo/release')
      ?.id

    expect(localData.targetBody).toContain('执行项目发布')
    expect(localData.targetBody).not.toContain('执行插件发布')
    expect(localOptions.systemPrompt).toContain('项目发布流程')
    expect(localOptions.systemPrompt).toContain('demo/release')
    expect(localOptions.promptAssetIds).toEqual(expect.arrayContaining([localSpecId]))

    expect(pluginData.targetBody).toContain('执行插件发布')
    expect(pluginOptions.systemPrompt).toContain('插件发布流程')
    expect(pluginOptions.promptAssetIds).toEqual(expect.arrayContaining([pluginSpecId]))
  })

  it('formats rules as markdown headings and blockquotes', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/rules/required.md'),
      [
        '---',
        'description: 必须执行的规则',
        'alwaysApply: true',
        '---',
        '# 标题',
        '',
        '正文第一行',
        '正文第二行'
      ].join('\n')
    )
    await writeDocument(
      join(workspace, '.ai/rules/summary-only.md'),
      [
        '---',
        'description: 只展示摘要',
        'alwaysApply: false',
        '---',
        '不应该出现在引用正文里'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      configs: [undefined, undefined],
      useDefaultVibeForgeMcpServer: false
    })
    const [, resolvedOptions] = await resolvePromptAssetSelection({
      bundle,
      type: undefined
    })

    expect(resolvedOptions.systemPrompt).toContain('# required')
    expect(resolvedOptions.systemPrompt).toContain('> # 标题')
    expect(resolvedOptions.systemPrompt).toContain('> 正文第一行')
    expect(resolvedOptions.systemPrompt).toContain('> 正文第二行')
    expect(resolvedOptions.systemPrompt).toContain('# summary-only')
    expect(resolvedOptions.systemPrompt).toContain('> 只展示摘要')
    expect(resolvedOptions.systemPrompt).not.toContain('> 不应该出现在引用正文里')
    expect(resolvedOptions.systemPrompt).not.toContain('--------------------')
  })
})
