/* eslint-disable import/first -- hoisted vitest mocks must be declared before importing the module under test */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path, { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findSkillsCli: vi.fn(),
  installSkillsCliRefToTemp: vi.fn(),
  installSkillsCliSkillToTemp: vi.fn()
}))

vi.mock('@vibe-forge/utils/skills-cli', async () => {
  const actual = await vi.importActual<typeof import('@vibe-forge/utils/skills-cli')>('@vibe-forge/utils/skills-cli')
  return {
    ...actual,
    findSkillsCli: mocks.findSkillsCli,
    installSkillsCliRefToTemp: mocks.installSkillsCliRefToTemp,
    installSkillsCliSkillToTemp: mocks.installSkillsCliSkillToTemp
  }
})

import { generateAdapterQueryOptions } from '#~/generate-adapter-query-options.js'

const tempDirs: string[] = []

const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'generate-adapter-query-options-skills-cli-'))
  const realHome = await mkdtemp(join(tmpdir(), 'generate-adapter-query-options-skills-cli-home-'))
  tempDirs.push(dir, realHome)
  process.env.__VF_PROJECT_REAL_HOME__ = realHome
  return dir
}

const writeDocument = async (filePath: string, content: string) => {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content)
}

const findSkillMarkdownFiles = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const nested = await Promise.all(entries.map(async (entry) => {
    const targetPath = join(root, entry.name)
    if (entry.isDirectory()) return findSkillMarkdownFiles(targetPath)
    return entry.isFile() && entry.name === 'SKILL.md' ? [targetPath] : []
  }))
  return nested.flat()
}

describe('generateAdapterQueryOptions skills CLI startup', () => {
  let installWorkspace: string

  beforeEach(async () => {
    installWorkspace = await mkdtemp(join(tmpdir(), 'generate-adapter-query-options-skills-cli-install-'))
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await rm(installWorkspace, { recursive: true, force: true })
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
    delete process.env.__VF_PROJECT_REAL_HOME__
  })

  it('installs remote skill dependencies before session startup when a selected skill declares a registry spec', async () => {
    const workspace = await createWorkspace()
    const installedSkillDir = join(installWorkspace, '.agents', 'skills', 'lynx-cat')
    await mkdir(installedSkillDir, { recursive: true })
    await writeFile(
      join(installedSkillDir, 'SKILL.md'),
      '---\nname: lynx-cat\ndescription: Lynx debugging helper\n---\nInspect the Lynx app.\n'
    )

    mocks.installSkillsCliSkillToTemp.mockResolvedValue({
      tempDir: installWorkspace,
      installedSkill: {
        dirName: 'lynx-cat',
        name: 'lynx-cat',
        sourcePath: installedSkillDir
      }
    })

    await writeDocument(
      join(workspace, '.ai/skills/lynx-miniapp/SKILL.md'),
      [
        '---',
        'name: lynx-miniapp',
        'description: lynx 调试使用',
        'dependencies:',
        '  - https://registry.example.com@example-source/lynx/skills@lynx-cat@latest',
        '---',
        '',
        '这是一个测试的 lynx 调试技能'
      ].join('\n')
    )

    const [, resolvedConfig] = await generateAdapterQueryOptions(
      undefined,
      undefined,
      workspace,
      {
        adapter: 'codex',
        skills: {
          include: ['lynx-miniapp']
        }
      }
    )

    const cachedSkillFiles = await findSkillMarkdownFiles(
      join(workspace, '.ai/caches/skill-dependencies')
    )
    const lynxCatSkillPath = cachedSkillFiles.find(filePath => filePath.includes(`${path.sep}lynx-cat${path.sep}`))
    const lynxCatSkillBody = lynxCatSkillPath == null ? '' : await readFile(lynxCatSkillPath, 'utf8')

    expect(mocks.installSkillsCliSkillToTemp).toHaveBeenCalledWith({
      registry: 'https://registry.example.com',
      skill: 'lynx-cat',
      source: 'example-source/lynx/skills',
      version: 'latest'
    })
    expect(resolvedConfig.systemPrompt).toContain('# lynx-miniapp')
    expect(lynxCatSkillPath).toBeDefined()
    expect(lynxCatSkillBody).toContain('name: lynx-cat')
  })
})
