import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findSkillsCli: vi.fn(),
  installSkillsCliRefToTemp: vi.fn(),
  installSkillsCliSkillToTemp: vi.fn()
}))

vi.mock('#~/skills-cli.js', async () => {
  const actual = await vi.importActual<typeof import('#~/skills-cli.js')>('#~/skills-cli.js')
  return {
    ...actual,
    findSkillsCli: mocks.findSkillsCli,
    installSkillsCliRefToTemp: mocks.installSkillsCliRefToTemp,
    installSkillsCliSkillToTemp: mocks.installSkillsCliSkillToTemp
  }
})

const tempDirs: string[] = []

const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

describe('project skill installs', () => {
  let installProjectSkill: typeof import('#~/project-skills.js').installProjectSkill

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it('replaces existing installed files via a temp directory swap and rewrites the local name', async () => {
    ;({ installProjectSkill } = await import('#~/project-skills.js'))
    const cwd = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vf-project-skills-install-')))
    tempDirs.push(cwd)

    const existingDir = path.join(cwd, '.ai', 'skills', 'internal-review')
    await mkdir(existingDir, { recursive: true })
    await writeFile(path.join(existingDir, 'SKILL.md'), '---\nname: stale-review\n---\nOld skill\n')
    await writeFile(path.join(existingDir, 'stale.txt'), 'stale file\n')

    const tempDir = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vf-project-skills-install-src-')))
    tempDirs.push(tempDir)
    const sourceDir = path.join(tempDir, 'design-review')
    await mkdir(sourceDir, { recursive: true })
    await writeFile(
      path.join(sourceDir, 'SKILL.md'),
      '---\nname: design-review\ndescription: Review code\n---\nReview skill body\n'
    )
    await writeFile(path.join(sourceDir, 'notes.md'), 'new supporting file\n')

    mocks.installSkillsCliSkillToTemp.mockResolvedValue({
      tempDir,
      installedSkill: {
        dirName: 'design-review',
        name: 'design-review',
        sourcePath: sourceDir
      }
    })

    await expect(installProjectSkill({
      force: true,
      skill: {
        name: 'design-review',
        rename: 'internal-review',
        source: 'example-source/default/public'
      },
      workspaceFolder: cwd
    })).resolves.toEqual(expect.objectContaining({
      dirName: 'internal-review',
      name: 'internal-review',
      ref: 'example-source/default/public@design-review'
    }))

    await expect(readFile(path.join(existingDir, 'SKILL.md'), 'utf8')).resolves.toContain('name: internal-review')
    await expect(readFile(path.join(existingDir, 'notes.md'), 'utf8')).resolves.toContain('new supporting file')
    await expect(pathExists(path.join(existingDir, 'stale.txt'))).resolves.toBe(false)
  })

  it('reuses an already installed target without re-downloading when force is disabled', async () => {
    ;({ installProjectSkill } = await import('#~/project-skills.js'))
    const cwd = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vf-project-skills-install-')))
    tempDirs.push(cwd)

    const existingDir = path.join(cwd, '.ai', 'skills', 'internal-review')
    await mkdir(existingDir, { recursive: true })
    await writeFile(
      path.join(existingDir, 'SKILL.md'),
      '---\nname: internal-review\ndescription: Review code\n---\nReview skill body\n'
    )

    await expect(installProjectSkill({
      force: false,
      skill: {
        name: 'design-review',
        rename: 'internal-review',
        source: 'example-source/default/public'
      },
      workspaceFolder: cwd
    })).resolves.toEqual(expect.objectContaining({
      dirName: 'internal-review',
      name: 'internal-review',
      skillPath: path.join(existingDir, 'SKILL.md')
    }))

    expect(mocks.installSkillsCliSkillToTemp).not.toHaveBeenCalled()
    expect(mocks.installSkillsCliRefToTemp).not.toHaveBeenCalled()
    expect(mocks.findSkillsCli).not.toHaveBeenCalled()
  })
})
