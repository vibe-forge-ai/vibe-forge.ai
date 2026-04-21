import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { resolveProjectSkillPublishSpec } from '#~/project-skills.js'

const tempDirs: string[] = []

describe('project skills publish resolution', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it('resolves an installed project skill name to its local directory', async () => {
    const cwd = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vf-project-skills-')))
    tempDirs.push(cwd)

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

    await expect(resolveProjectSkillPublishSpec({
      selector: 'internal-review',
      workspaceFolder: cwd
    })).resolves.toEqual({
      kind: 'project',
      requested: 'internal-review',
      skillSpec: path.join(cwd, '.ai/skills/internal-review'),
      dirName: 'internal-review',
      name: 'internal-review'
    })
  })

  it('passes remote publish specs through unchanged', async () => {
    const cwd = await realpath(await mkdtemp(path.join(os.tmpdir(), 'vf-project-skills-')))
    tempDirs.push(cwd)

    await expect(resolveProjectSkillPublishSpec({
      selector: 'git@code.byted.org:my-org/my-skill.git',
      workspaceFolder: cwd
    })).resolves.toEqual({
      kind: 'remote',
      requested: 'git@code.byted.org:my-org/my-skill.git',
      skillSpec: 'git@code.byted.org:my-org/my-skill.git'
    })
  })
})
