import { Command } from 'commander'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetConfigCache } from '@vibe-forge/config'

import { registerSkillsCommand } from '#~/commands/skills.js'

const mocks = vi.hoisted(() => ({
  installProjectSkill: vi.fn(),
  publishSkillsCli: vi.fn(),
  readProjectSkills: vi.fn(),
  removeProjectSkill: vi.fn()
}))

vi.mock('@vibe-forge/utils', async () => {
  const actual = await vi.importActual<typeof import('@vibe-forge/utils')>('@vibe-forge/utils')
  return {
    ...actual,
    installProjectSkill: mocks.installProjectSkill,
    publishSkillsCli: mocks.publishSkillsCli,
    readProjectSkills: mocks.readProjectSkills,
    removeProjectSkill: mocks.removeProjectSkill
  }
})

const tempDirs: string[] = []

describe('skills command', () => {
  const originalCwd = process.cwd()
  const originalWorkspaceFolder = process.env.__VF_PROJECT_WORKSPACE_FOLDER__
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetConfigCache()
    vi.clearAllMocks()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    if (originalWorkspaceFolder == null) {
      delete process.env.__VF_PROJECT_WORKSPACE_FOLDER__
    } else {
      process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = originalWorkspaceFolder
    }
    logSpy.mockRestore()
    errorSpy.mockRestore()
    resetConfigCache()
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it('adds a configured skill and installs it immediately', async () => {
    const cwd = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vf-skills-command-')))
    tempDirs.push(cwd)
    process.chdir(cwd)

    mocks.installProjectSkill.mockResolvedValue({
      dirName: 'internal-review',
      installDir: path.join(cwd, '.ai/skills/internal-review'),
      name: 'internal-review',
      ref: 'example-source/default/public@design-review',
      skillPath: path.join(cwd, '.ai/skills/internal-review/SKILL.md')
    })

    const program = new Command()
    registerSkillsCommand(program)

    await program.parseAsync([
      'skills',
      'add',
      'design-review',
      '--source',
      'example-source/default/public',
      '--rename',
      'internal-review'
    ], { from: 'user' })

    expect(mocks.installProjectSkill).toHaveBeenCalledWith(expect.objectContaining({
      force: false,
      registry: undefined,
      skill: expect.objectContaining({
        name: 'design-review',
        source: 'example-source/default/public',
        rename: 'internal-review',
        targetName: 'internal-review'
      }),
      workspaceFolder: cwd
    }))

    const config = JSON.parse(await readFile(path.join(cwd, '.ai.config.json'), 'utf8'))
    expect(config.skills).toEqual([
      {
        name: 'design-review',
        source: 'example-source/default/public',
        rename: 'internal-review'
      }
    ])
  })

  it('treats semantically identical configured skills as duplicates even when key order differs', async () => {
    const cwd = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vf-skills-command-')))
    tempDirs.push(cwd)
    process.chdir(cwd)

    await writeFile(
      path.join(cwd, '.ai.config.json'),
      JSON.stringify(
        {
          skills: [
            {
              source: 'example-source/default/public',
              rename: 'internal-review',
              name: 'design-review'
            }
          ]
        },
        null,
        2
      )
    )

    mocks.installProjectSkill.mockResolvedValue({
      dirName: 'internal-review',
      installDir: path.join(cwd, '.ai/skills/internal-review'),
      name: 'internal-review',
      ref: 'example-source/default/public@design-review',
      skillPath: path.join(cwd, '.ai/skills/internal-review/SKILL.md')
    })

    const program = new Command()
    registerSkillsCommand(program)

    await program.parseAsync([
      'skills',
      'add',
      'design-review',
      '--source',
      'example-source/default/public',
      '--rename',
      'internal-review'
    ], { from: 'user' })

    const config = JSON.parse(await readFile(path.join(cwd, '.ai.config.json'), 'utf8'))
    expect(config.skills).toHaveLength(1)
    expect(mocks.installProjectSkill).toHaveBeenCalledTimes(1)
  })

  it('installs configured skills by default and forces updates for the update command', async () => {
    const cwd = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vf-skills-command-')))
    tempDirs.push(cwd)
    process.chdir(cwd)

    await writeFile(
      path.join(cwd, '.ai.config.json'),
      JSON.stringify(
        {
          skills: [
            'frontend-design',
            {
              name: 'design-review',
              source: 'example-source/default/public',
              rename: 'internal-review'
            }
          ]
        },
        null,
        2
      )
    )

    mocks.installProjectSkill.mockResolvedValue({
      dirName: 'internal-review',
      installDir: path.join(cwd, '.ai/skills/internal-review'),
      name: 'internal-review',
      ref: 'example-source/default/public@design-review',
      skillPath: path.join(cwd, '.ai/skills/internal-review/SKILL.md')
    })

    const program = new Command()
    registerSkillsCommand(program)

    await program.parseAsync(['skills', 'install'], { from: 'user' })
    expect(mocks.installProjectSkill).toHaveBeenCalledTimes(2)
    expect(mocks.installProjectSkill).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        force: false,
        skill: expect.objectContaining({
          name: 'frontend-design',
          ref: 'frontend-design',
          targetName: 'frontend-design'
        })
      })
    )
    expect(mocks.installProjectSkill).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        force: false,
        skill: expect.objectContaining({
          name: 'design-review',
          source: 'example-source/default/public',
          rename: 'internal-review',
          targetName: 'internal-review'
        })
      })
    )

    mocks.installProjectSkill.mockClear()

    await program.parseAsync(['skills', 'update'], { from: 'user' })
    expect(mocks.installProjectSkill).toHaveBeenCalledTimes(2)
    expect(mocks.installProjectSkill).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        force: true,
        skill: expect.objectContaining({
          name: 'frontend-design',
          ref: 'frontend-design',
          targetName: 'frontend-design'
        })
      })
    )
    expect(mocks.installProjectSkill).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        force: true,
        skill: expect.objectContaining({
          name: 'design-review',
          source: 'example-source/default/public',
          rename: 'internal-review',
          targetName: 'internal-review'
        })
      })
    )
  })

  it('removes configured skills and deletes installed files', async () => {
    const cwd = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vf-skills-command-')))
    tempDirs.push(cwd)
    process.chdir(cwd)

    await writeFile(
      path.join(cwd, '.ai.config.json'),
      JSON.stringify(
        {
          skills: [
            {
              name: 'design-review',
              source: 'example-source/default/public',
              rename: 'internal-review'
            }
          ]
        },
        null,
        2
      )
    )

    mocks.readProjectSkills.mockResolvedValue([
      {
        dirName: 'internal-review',
        name: 'internal-review'
      }
    ])
    mocks.removeProjectSkill.mockResolvedValue({
      dirName: 'internal-review',
      installDir: path.join(cwd, '.ai/skills/internal-review')
    })

    const program = new Command()
    registerSkillsCommand(program)

    await program.parseAsync(['skills', 'remove', 'internal-review'], { from: 'user' })

    expect(mocks.removeProjectSkill).toHaveBeenCalledWith({
      dirName: 'internal-review',
      workspaceFolder: cwd
    })

    const config = JSON.parse(await readFile(path.join(cwd, '.ai.config.json'), 'utf8'))
    expect(config).toEqual({})
  })

  it('publishes a local project skill through the active skills cli runtime', async () => {
    const cwd = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vf-skills-command-')))
    tempDirs.push(cwd)
    process.chdir(cwd)
    await mkdir(path.join(cwd, '.ai/skills/internal-review'), { recursive: true })
    await writeFile(
      path.join(cwd, '.ai/skills/internal-review/SKILL.md'),
      [
        '---',
        'name: internal-review',
        'description: Internal review flow',
        '---',
        '',
        'Review code.'
      ].join('\n')
    )

    mocks.publishSkillsCli.mockResolvedValue({
      stdout: 'Published internal-review',
      stderr: '',
      output: 'Published internal-review'
    })

    const program = new Command()
    registerSkillsCommand(program)

    await program.parseAsync([
      'skills',
      'publish',
      'internal-review',
      '--group',
      'default/public',
      '--access',
      'restricted',
      '--region',
      'cn',
      '--yes'
    ], { from: 'user' })

    expect(mocks.publishSkillsCli).toHaveBeenCalledWith({
      access: 'restricted',
      cwd,
      group: 'default/public',
      region: 'cn',
      registry: undefined,
      skillSpec: path.join(cwd, '.ai/skills/internal-review'),
      yes: true
    })
  })
})
