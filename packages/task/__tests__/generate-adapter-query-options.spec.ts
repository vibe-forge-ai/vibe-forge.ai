import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { generateAdapterQueryOptions } from '#~/generate-adapter-query-options.js'

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
  it('keeps entity prompt generation stable when entity metadata contains rule references', async () => {
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

    const [, resolvedConfig] = await generateAdapterQueryOptions(
      'entity',
      'api-developer',
      workspace
    )

    expect(resolvedConfig.systemPrompt).toContain('你是 API 开发实体')
  })

  it('keeps explicitly included skills as route guidance in normal mode', async () => {
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

    expect(resolvedConfig.systemPrompt).not.toContain('The following skill modules are loaded for the project')
    expect(resolvedConfig.systemPrompt).toContain('<skills>')
    expect(resolvedConfig.systemPrompt).toContain('# research')
    expect(resolvedConfig.systemPrompt).toContain('> Skill description: 检索资料')
    expect(resolvedConfig.systemPrompt).toContain('> Skill file path: .ai/skills/research/SKILL.md')
    expect(resolvedConfig.systemPrompt).toContain(
      '> Do not preload the body by default; read the corresponding skill file only when the task clearly requires it.'
    )
    expect(resolvedConfig.systemPrompt).not.toContain('<skill-content>')
    expect(resolvedConfig.systemPrompt).not.toContain('# review')
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

    expect(resolvedConfig.systemPrompt).toContain('<skills>')
    expect(resolvedConfig.systemPrompt).toContain('# research')
    expect(resolvedConfig.systemPrompt).toContain('> Skill file path: .ai/skills/research/SKILL.md')
    expect(resolvedConfig.systemPrompt).not.toContain('# review')
    expect(resolvedConfig.systemPrompt).not.toContain('<skill-content>')
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

    expect(resolvedConfig.systemPrompt).toContain('The following skill modules are loaded for the project')
    expect(resolvedConfig.systemPrompt).toContain('# review')
    expect(resolvedConfig.systemPrompt).toContain('> Skill description: 代码评审')
    expect(resolvedConfig.systemPrompt).toContain('<skill-content>')
    expect(resolvedConfig.systemPrompt).toContain('检查风险')
    expect(resolvedConfig.systemPrompt).not.toContain('<skills>\n# review')
    expect(resolvedConfig.systemPrompt).toContain('<skills>')
    expect(resolvedConfig.systemPrompt).toContain('# research')
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

    expect(resolvedConfig.systemPrompt).toContain('The following skill modules are loaded for the project')
    expect(resolvedConfig.systemPrompt).toContain('# research')
    expect(resolvedConfig.systemPrompt).toContain('<skill-content>')
    expect(resolvedConfig.systemPrompt).toContain('阅读 README.md')
    expect(resolvedConfig.systemPrompt).toContain('<skills>')
    expect(resolvedConfig.systemPrompt).toContain('# review')
    expect(resolvedConfig.systemPrompt).not.toContain('<skills>\n# research')
    expect(resolvedConfig.systemPrompt).not.toContain('<skill-content>\n检查风险\n</skill-content>')
  })
})
