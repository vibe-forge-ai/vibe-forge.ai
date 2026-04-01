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
    expect(options.systemPrompt).toContain('> 适用场景：按需参考规则')
    expect(options.systemPrompt).toContain('> 规则文件路径：.ai/rules/optional.md')
    expect(options.systemPrompt).toContain('> 仅在任务满足上述场景时，再阅读该规则文件。')
    expect(options.systemPrompt).not.toContain('> 只有在特定场景才需要展开。')
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
    expect(resolvedOptions.systemPrompt).toContain('> 适用场景：只展示摘要')
    expect(resolvedOptions.systemPrompt).toContain('> 规则文件路径：.ai/rules/summary-only.md')
    expect(resolvedOptions.systemPrompt).not.toContain('> 不应该出现在引用正文里')
    expect(resolvedOptions.systemPrompt).not.toContain('--------------------')
  })

  it('keeps skills as route-only guidance unless the target spec references them', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      [
        '---',
        'description: 检索项目信息',
        '---',
        '先读 README.md'
      ].join('\n')
    )
    await writeDocument(
      join(workspace, '.ai/skills/review/SKILL.md'),
      [
        '---',
        'description: 评审代码改动',
        '---',
        '检查回归风险'
      ].join('\n')
    )
    await writeDocument(
      join(workspace, '.ai/specs/release/index.md'),
      [
        '---',
        'description: 发布流程',
        'skills:',
        '  - research',
        '---',
        '执行发布'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      useDefaultVibeForgeMcpServer: false
    })
    const [data, options] = await resolvePromptAssetSelection({
      bundle,
      type: 'spec',
      name: 'release'
    })

    expect(data.targetSkills.map(skill => skill.resolvedName ?? skill.attributes.name)).toEqual(['research'])
    expect(options.systemPrompt).toContain('项目已加载如下技能模块')
    expect(options.systemPrompt).toContain('# research')
    expect(options.systemPrompt).toContain('> 技能文件路径：.ai/skills/research/SKILL.md')
    expect(options.systemPrompt).toContain('<skill-content>')
    expect(options.systemPrompt).toContain('先读 README.md')
    expect(options.systemPrompt).toContain('# review')
    expect(options.systemPrompt).toContain('> 技能文件路径：.ai/skills/review/SKILL.md')
    expect(options.systemPrompt).toContain('> 默认无需预先加载正文；仅在任务明确需要该技能时，再读取对应技能文件。')
    expect(options.systemPrompt).not.toContain('<skill-content>\n检查回归风险\n</skill-content>')
  })

  it('keeps skills as route-only guidance in normal mode', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      [
        '---',
        'description: 检索项目信息',
        '---',
        '先读 README.md'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      useDefaultVibeForgeMcpServer: false
    })
    const [data, options] = await resolvePromptAssetSelection({
      bundle,
      type: undefined
    })

    expect(data.targetSkills).toEqual([])
    expect(options.systemPrompt).not.toContain('项目已加载如下技能模块')
    expect(options.systemPrompt).toContain('<skills>')
    expect(options.systemPrompt).toContain('# research')
    expect(options.systemPrompt).toContain('> 技能文件路径：.ai/skills/research/SKILL.md')
    expect(options.systemPrompt).toContain('> 默认无需预先加载正文；仅在任务明确需要该技能时，再读取对应技能文件。')
    expect(options.systemPrompt).not.toContain('<skill-content>')
    expect(options.systemPrompt).not.toContain('先读 README.md')
  })

  it('keeps spec route guidance without default identity in normal mode', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/specs/release/index.md'),
      [
        '---',
        'description: 发布流程',
        '---',
        '执行发布'
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

    expect(options.systemPrompt).toContain('项目存在如下工作流程')
    expect(options.systemPrompt).toContain('流程名称：release')
    expect(options.systemPrompt).not.toContain('项目推进管理大师')
  })

  it('injects spec identity guidance when a spec is actively selected', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/specs/release/index.md'),
      [
        '---',
        'description: 发布流程',
        '---',
        '执行发布'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      useDefaultVibeForgeMcpServer: false
    })
    const [, options] = await resolvePromptAssetSelection({
      bundle,
      type: 'spec',
      name: 'release'
    })

    expect(options.systemPrompt).toContain('项目推进管理大师')
    expect(options.systemPrompt).toContain('永远不要单独完成代码开发工作')
    expect(options.systemPrompt).toContain('流程名称：release')
  })

  it('embeds referenced skills for entity mode and removes them from route guidance', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      [
        '---',
        'description: 检索项目信息',
        '---',
        '先读 README.md'
      ].join('\n')
    )
    await writeDocument(
      join(workspace, '.ai/skills/review/SKILL.md'),
      [
        '---',
        'description: 评审代码改动',
        '---',
        '检查回归风险'
      ].join('\n')
    )
    await writeDocument(
      join(workspace, '.ai/entities/reviewer/README.md'),
      [
        '---',
        'description: 代码评审实体',
        'skills:',
        '  - review',
        '---',
        '负责代码评审'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      useDefaultVibeForgeMcpServer: false
    })
    const [data, options] = await resolvePromptAssetSelection({
      bundle,
      type: 'entity',
      name: 'reviewer'
    })

    expect(data.targetSkills.map(skill => skill.resolvedName ?? skill.attributes.name)).toEqual(['review'])
    expect(options.systemPrompt).toContain('项目已加载如下技能模块')
    expect(options.systemPrompt).toContain('# review')
    expect(options.systemPrompt).toContain('<skill-content>')
    expect(options.systemPrompt).toContain('检查回归风险')
    expect(options.systemPrompt).not.toContain('<skills>\n# review')
    expect(options.systemPrompt).toContain('<skills>')
    expect(options.systemPrompt).toContain('# research')
    expect(options.systemPrompt).toContain('> 技能文件路径：.ai/skills/research/SKILL.md')
    expect(options.systemPrompt).not.toContain('<skill-content>\n先读 README.md\n</skill-content>')
  })

  it('does not preload all skills when the target entity omits skill references', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      [
        '---',
        'description: 检索项目信息',
        '---',
        '先读 README.md'
      ].join('\n')
    )
    await writeDocument(
      join(workspace, '.ai/entities/reviewer/README.md'),
      [
        '---',
        'description: 代码评审实体',
        '---',
        '负责代码评审'
      ].join('\n')
    )

    const bundle = await resolveWorkspaceAssetBundle({
      cwd: workspace,
      useDefaultVibeForgeMcpServer: false
    })
    const [data, options] = await resolvePromptAssetSelection({
      bundle,
      type: 'entity',
      name: 'reviewer'
    })

    expect(data.targetSkills).toEqual([])
    expect(options.systemPrompt).not.toContain('项目已加载如下技能模块')
    expect(options.systemPrompt).toContain('# research')
    expect(options.systemPrompt).toContain('> 技能文件路径：.ai/skills/research/SKILL.md')
    expect(options.systemPrompt).not.toContain('先读 README.md')
  })
})
