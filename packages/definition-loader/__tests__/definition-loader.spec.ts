import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { DefinitionLoader } from '#~/definition-loader.js'

const tempDirs: string[] = []

const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'definition-loader-'))
  tempDirs.push(dir)
  return dir
}

const writeDocument = async (filePath: string, content: string) => {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content)
}

const installPluginPackage = async (workspace: string, packageName: string, files: Record<string, string>) => {
  const packageDir = join(workspace, 'node_modules', ...packageName.split('/'))
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      await writeDocument(join(packageDir, relativePath), content)
    })
  )
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('definitionLoader', () => {
  it('generates skill prompts with stable names, descriptions and relative paths', () => {
    const cwd = '/workspace/project'
    const loader = new DefinitionLoader(cwd)

    const prompt = loader.generateSkillsPrompt([
      {
        path: join(cwd, '.ai/skills/research/SKILL.md'),
        body: '阅读 README.md\n',
        attributes: {
          description: '检索项目信息'
        }
      }
    ])

    expect(prompt).toContain('项目已加载如下技能模块')
    expect(prompt).toContain('# research')
    expect(prompt).toContain('> 技能介绍：检索项目信息')
    expect(prompt).toContain('> 技能文件路径：.ai/skills/research/SKILL.md')
    expect(prompt).toContain('<skill-content>')
    expect(prompt).not.toContain('/workspace/project/.ai/skills/research/SKILL.md')
  })

  it('generates spec routes with logical identifiers instead of file paths', () => {
    const cwd = '/workspace/project'
    const loader = new DefinitionLoader(cwd)

    const prompt = loader.generateSpecRoutePrompt([
      {
        path: join(cwd, '.ai/specs/release/index.md'),
        body: '发布流程\n执行发布任务',
        attributes: {
          params: [
            {
              name: 'version',
              description: '版本号'
            }
          ]
        }
      },
      {
        path: join(cwd, '.ai/specs/internal.md'),
        body: '内部流程',
        attributes: {
          always: false
        }
      }
    ])

    expect(prompt).toContain('流程名称：release')
    expect(prompt).toContain('介绍：发布流程')
    expect(prompt).toContain('标识：release')
    expect(prompt).toContain('    - version：版本号')
    expect(prompt).not.toContain('.ai/specs/release/index.md')
    expect(prompt).not.toContain('internal')
  })

  it('generates rule prompts with markdown headings and alwaysApply compatibility', () => {
    const cwd = '/workspace/project'
    const loader = new DefinitionLoader(cwd)

    const prompt = loader.generateRulesPrompt([
      {
        path: join(cwd, '.ai/rules/required.md'),
        body: '# 标题\n\n正文',
        attributes: {
          alwaysApply: true
        }
      },
      {
        path: join(cwd, '.ai/rules/summary-only.md'),
        body: '不应该内联',
        attributes: {
          description: '只展示摘要',
          alwaysApply: false
        }
      }
    ])

    expect(prompt).toContain('# required')
    expect(prompt).toContain('> # 标题')
    expect(prompt).toContain('> 正文')
    expect(prompt).toContain('# summary-only')
    expect(prompt).toContain('> 适用场景：只展示摘要')
    expect(prompt).toContain('> 规则文件路径：.ai/rules/summary-only.md')
    expect(prompt).not.toContain('> 不应该内联')
    expect(prompt).not.toContain('--------------------')
  })

  it('generates entity routes from summaries instead of full bodies', () => {
    const cwd = '/workspace/project'
    const loader = new DefinitionLoader(cwd)

    const prompt = loader.generateEntitiesRoutePrompt([
      {
        path: join(cwd, '.ai/entities/reviewer/README.md'),
        body: '负责代码审查\n需要关注变更风险',
        attributes: {}
      },
      {
        path: join(cwd, '.ai/entities/hidden.md'),
        body: '不应暴露',
        attributes: {
          name: 'hidden',
          always: false
        }
      }
    ])

    expect(prompt).toContain('reviewer：负责代码审查')
    expect(prompt).not.toContain('需要关注变更风险')
    expect(prompt).not.toContain('hidden')
  })

  it('treats alwaysApply rules as embedded system rules', () => {
    const cwd = '/workspace/project'
    const loader = new DefinitionLoader(cwd)

    const prompt = loader.generateRulesPrompt([
      {
        path: join(cwd, '.ai/rules/base.md'),
        body: '始终检查导入边界。',
        attributes: {
          description: '基础规则',
          alwaysApply: true
        }
      },
      {
        path: join(cwd, '.ai/rules/optional.md'),
        body: '仅在特定任务参考。',
        attributes: {
          description: '按需规则',
          alwaysApply: false
        }
      }
    ])

    expect(prompt).toContain('# base')
    expect(prompt).toContain('> 始终检查导入边界。')
    expect(prompt).toContain('# optional')
    expect(prompt).toContain('> 适用场景：按需规则')
    expect(prompt).toContain('> 规则文件路径：.ai/rules/optional.md')
    expect(prompt).not.toContain('仅在特定任务参考。')
  })

  it('generates skill routes with file guidance and without embedded bodies', () => {
    const cwd = '/workspace/project'
    const loader = new DefinitionLoader(cwd)

    const prompt = loader.generateSkillsRoutePrompt([
      {
        path: join(cwd, '.ai/skills/research/SKILL.md'),
        body: '阅读 README.md\n',
        attributes: {
          description: '检索项目信息'
        }
      }
    ])

    expect(prompt).toContain('# research')
    expect(prompt).toContain('> 技能介绍：检索项目信息')
    expect(prompt).toContain('> 技能文件路径：.ai/skills/research/SKILL.md')
    expect(prompt).toContain('> 默认无需预先加载正文；仅在任务明确需要该技能时，再读取对应技能文件。')
    expect(prompt).not.toContain('<skill-content>')
    expect(prompt).not.toContain('阅读 README.md')
  })

  it('loads npm plugin specs and README based entities consistently', async () => {
    const workspace = await createWorkspace()
    const loader = new DefinitionLoader(workspace)

    await writeDocument(
      join(workspace, '.ai.config.json'),
      JSON.stringify({
        plugins: [
          {
            id: 'demo'
          }
        ]
      })
    )
    await installPluginPackage(workspace, '@vibe-forge/plugin-demo', {
      'package.json': JSON.stringify(
        {
          name: '@vibe-forge/plugin-demo',
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
        '  assets: {',
        '    specs: "./specs"',
        '  }',
        '};',
        ''
      ].join('\n'),
      'specs/ship/index.md': '---\ndescription: 插件发布流程\n---\n执行插件发布'
    })
    await writeDocument(
      join(workspace, '.ai/entities/reviewer/README.md'),
      '---\ndescription: 代码审查实体\n---\n负责代码审查'
    )
    await writeDocument(
      join(workspace, '.ai/entities/planner.md'),
      '---\ndescription: 任务规划实体\n---\n负责拆解任务'
    )

    const pluginSpec = await loader.loadSpec('ship')
    const reviewer = await loader.loadEntity('reviewer')
    const planner = await loader.loadEntity('planner')
    const entities = await loader.loadDefaultEntities()

    expect(pluginSpec?.path).toContain('/node_modules/@vibe-forge/plugin-demo/specs/ship/index.md')
    expect(reviewer?.path).toContain('/.ai/entities/reviewer/README.md')
    expect(planner?.path).toContain('/.ai/entities/planner.md')
    expect(entities.map((entity: (typeof entities)[number]) => entity.path)).toEqual([
      join(workspace, '.ai/entities/planner.md'),
      join(workspace, '.ai/entities/reviewer/README.md')
    ])
  })
})
