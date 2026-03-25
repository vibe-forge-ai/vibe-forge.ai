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
})
