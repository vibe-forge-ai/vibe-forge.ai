import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { DefinitionLoader } from '#~/utils/definition-loader.js'

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

    expect(prompt).toContain('技能名称：research')
    expect(prompt).toContain('技能介绍：检索项目信息')
    expect(prompt).toContain('技能文件资源路径：.ai/skills/research')
    expect(prompt).not.toContain('/workspace/project/.ai/skills/research')
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

  it('loads plugin directory specs and README based entities consistently', async () => {
    const workspace = await createWorkspace()
    const loader = new DefinitionLoader(workspace)

    await writeDocument(
      join(workspace, '.ai/plugins/demo/specs/ship/index.md'),
      '---\ndescription: 插件发布流程\n---\n执行插件发布'
    )
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

    expect(pluginSpec?.path).toContain('/.ai/plugins/demo/specs/ship/index.md')
    expect(reviewer?.path).toContain('/.ai/entities/reviewer/README.md')
    expect(planner?.path).toContain('/.ai/entities/planner.md')
    expect(entities.map((entity: (typeof entities)[number]) => entity.path)).toEqual([
      join(workspace, '.ai/entities/planner.md'),
      join(workspace, '.ai/entities/reviewer/README.md')
    ])
  })
})
