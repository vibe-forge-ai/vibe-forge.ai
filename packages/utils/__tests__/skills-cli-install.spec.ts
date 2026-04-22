import { rm } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runSkillsCli: vi.fn(),
  selectInstalledSkillDir: vi.fn()
}))

vi.mock('#~/skills-cli/runtime.js', () => ({
  runSkillsCli: mocks.runSkillsCli
}))

vi.mock('#~/skills-cli/installed-skill.js', () => ({
  selectInstalledSkillDir: mocks.selectInstalledSkillDir
}))

describe('skills CLI install helpers', () => {
  const tempDirs: string[] = []
  let installSkillsCliSkillToTemp: typeof import('#~/skills-cli/install.js').installSkillsCliSkillToTemp

  beforeEach(async () => {
    vi.clearAllMocks()
    ;({ installSkillsCliSkillToTemp } = await import('#~/skills-cli/install.js'))
    mocks.runSkillsCli.mockResolvedValue({ stderr: '', stdout: '' })
    mocks.selectInstalledSkillDir.mockImplementation(async ({ installedSkillsDir, requestedSkill }) => {
      tempDirs.push(installedSkillsDir.replace(/\/\.agents\/skills$/, ''))
      return {
        dirName: requestedSkill,
        name: requestedSkill,
        sourcePath: `${installedSkillsDir}/${requestedSkill}`
      }
    })
  })

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it('omits the version flag when the requested version is latest', async () => {
    await installSkillsCliSkillToTemp({
      registry: 'https://registry.example.com',
      skill: 'lynx-cat',
      source: 'example-source/lynx/skills',
      version: 'latest'
    })

    expect(mocks.runSkillsCli).toHaveBeenCalledWith(expect.objectContaining({
      args: [
        'add',
        'example-source/lynx/skills',
        '--skill',
        'lynx-cat',
        '--agent',
        'universal',
        '--copy',
        '-y'
      ],
      registry: 'https://registry.example.com'
    }))
  })

  it('keeps explicit pinned versions when provided', async () => {
    await installSkillsCliSkillToTemp({
      registry: 'https://registry.example.com',
      skill: 'lynx-cat',
      source: 'example-source/lynx/skills',
      version: '1.0.3'
    })

    expect(mocks.runSkillsCli).toHaveBeenCalledWith(expect.objectContaining({
      args: [
        'add',
        'example-source/lynx/skills',
        '--skill',
        'lynx-cat',
        '--version',
        '1.0.3',
        '--agent',
        'universal',
        '--copy',
        '-y'
      ]
    }))
  })
})
