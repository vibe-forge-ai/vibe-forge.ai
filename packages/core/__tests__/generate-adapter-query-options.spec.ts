import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { generateAdapterQueryOptions } from '#~/controllers/task/generate-adapter-query-options.js'

const tempDirs: string[] = []

const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'generate-adapter-query-options-'))
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

describe('generateAdapterQueryOptions', () => {
  it('loads local and remote entity rule references without crashing', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/entities/api-developer/rules/migrate.md'),
      '---\ndescription: 文件内描述\n---\n遵循新的 API 迁移流程'
    )
    await writeDocument(
      join(workspace, '.ai/entities/api-developer/index.json'),
      JSON.stringify(
        {
          prompt: '你是 API 开发实体',
          rules: [
            {
              path: './rules/migrate.md',
              desc: '迁移老范式的 API 代码到新范式'
            },
            {
              type: 'remote',
              tags: ['business', 'api-develop'],
              desc: '遇到未说明的方法时，可查询远程知识库'
            }
          ]
        },
        null,
        2
      )
    )

    const [{ rules }, resolvedConfig] = await generateAdapterQueryOptions(
      'entity',
      'api-developer',
      workspace
    )

    expect(rules).toHaveLength(2)
    expect(resolvedConfig.systemPrompt).toContain('迁移老范式的 API 代码到新范式')
    expect(resolvedConfig.systemPrompt).toContain('遵循新的 API 迁移流程')
    expect(resolvedConfig.systemPrompt).toContain('遇到未说明的方法时，可查询远程知识库')
    expect(resolvedConfig.systemPrompt).toContain('知识库标签：business, api-develop')
  })

  it('loads explicitly included skills into the generated system prompt', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )
    await writeDocument(
      join(workspace, '.ai/skills/review/SKILL.md'),
      '---\ndescription: 代码评审\n---\n检查风险'
    )

    const [, resolvedConfig] = await generateAdapterQueryOptions(
      undefined,
      undefined,
      workspace,
      {
        skills: {
          include: ['research']
        }
      }
    )

    expect(resolvedConfig.systemPrompt).toContain('技能名称：research')
    expect(resolvedConfig.systemPrompt).toContain('技能介绍：检索资料')
    expect(resolvedConfig.systemPrompt).toContain('research：检索资料')
    expect(resolvedConfig.systemPrompt).not.toContain('review：代码评审')
  })

  it('removes excluded skills from the generated skill routes', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )
    await writeDocument(
      join(workspace, '.ai/skills/review/SKILL.md'),
      '---\ndescription: 代码评审\n---\n检查风险'
    )

    const [, resolvedConfig] = await generateAdapterQueryOptions(
      undefined,
      undefined,
      workspace,
      {
        skills: {
          exclude: ['review']
        }
      }
    )

    expect(resolvedConfig.systemPrompt).toContain('research：检索资料')
    expect(resolvedConfig.systemPrompt).not.toContain('review：代码评审')
    expect(resolvedConfig.systemPrompt).not.toContain('技能名称：review')
  })

  it('supports entity skill include selectors', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )
    await writeDocument(
      join(workspace, '.ai/skills/review/SKILL.md'),
      '---\ndescription: 代码评审\n---\n检查风险'
    )
    await writeDocument(
      join(workspace, '.ai/entities/api-developer/index.json'),
      JSON.stringify(
        {
          prompt: '你是 API 开发实体',
          skills: {
            type: 'include',
            list: ['review']
          }
        },
        null,
        2
      )
    )

    const [, resolvedConfig] = await generateAdapterQueryOptions(
      'entity',
      'api-developer',
      workspace
    )

    expect(resolvedConfig.systemPrompt).toContain('技能名称：review')
    expect(resolvedConfig.systemPrompt).toContain('review：代码评审')
    expect(resolvedConfig.systemPrompt).not.toContain('research：检索资料')
  })

  it('supports entity skill exclude selectors', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )
    await writeDocument(
      join(workspace, '.ai/skills/review/SKILL.md'),
      '---\ndescription: 代码评审\n---\n检查风险'
    )
    await writeDocument(
      join(workspace, '.ai/entities/api-developer/index.json'),
      JSON.stringify(
        {
          prompt: '你是 API 开发实体',
          skills: {
            type: 'exclude',
            list: ['review']
          }
        },
        null,
        2
      )
    )

    const [, resolvedConfig] = await generateAdapterQueryOptions(
      'entity',
      'api-developer',
      workspace
    )

    expect(resolvedConfig.systemPrompt).toContain('research：检索资料')
    expect(resolvedConfig.systemPrompt).not.toContain('review：代码评审')
    expect(resolvedConfig.systemPrompt).not.toContain('技能名称：review')
  })
})
