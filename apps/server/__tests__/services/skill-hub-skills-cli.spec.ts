import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ensureManagedNpmCli: vi.fn(),
  execFile: vi.fn()
}))

vi.mock('node:child_process', () => ({
  execFile: mocks.execFile
}))

vi.mock('@vibe-forge/utils/managed-npm-cli', () => ({
  ensureManagedNpmCli: mocks.ensureManagedNpmCli
}))

const createExecImplementation = (
  callback: (
    args: string[],
    options: { cwd?: string }
  ) => { stderr?: string; stdout?: string } | Error | Promise<{ stderr?: string; stdout?: string } | Error>
) => {
  mocks.execFile.mockImplementation(
    ((...invokeArgs: any[]) => {
      const args = invokeArgs[1] as string[]
      const options = invokeArgs[2] as { cwd?: string }
      const done = invokeArgs[3] as ((error: Error | null, stdout: string, stderr: string) => void)

      Promise.resolve(callback(args, options))
        .then((result) => {
          if (result instanceof Error) {
            done(
              result,
              (result as Error & { stdout?: string }).stdout ?? '',
              (result as Error & { stderr?: string }).stderr ?? ''
            )
            return
          }

          done(null, result.stdout ?? '', result.stderr ?? '')
        })
        .catch((error) => {
          done(error, error?.stdout ?? '', error?.stderr ?? '')
        })

      return {} as any
    }) as any
  )
}

describe('skills CLI skill hub source flow', () => {
  let workspace: string

  beforeEach(async () => {
    workspace = await mkdtemp(path.join(os.tmpdir(), 'vf-skill-hub-skills-cli-'))
    mocks.ensureManagedNpmCli.mockResolvedValue('/mock/bin/skills')
    vi.clearAllMocks()
    mocks.ensureManagedNpmCli.mockResolvedValue('/mock/bin/skills')
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  it('parses fancy skills --list output', async () => {
    const { parseSkillsCliListOutput } = await import('#~/services/skill-hub/skills-cli.js')
    expect(parseSkillsCliListOutput([
      '◇  Available Skills',
      '│',
      '│    internal-review',
      '│',
      '│      Review code with internal checklists.',
      '│',
      '│    docs-writer',
      '│',
      '│      Write release docs with internal templates.',
      '│',
      '└  Use --skill <name> to install specific skills'
    ].join('\n'))).toEqual([
      {
        name: 'internal-review',
        description: 'Review code with internal checklists.'
      },
      {
        name: 'docs-writer',
        description: 'Write release docs with internal templates.'
      }
    ])
  })

  it('lists skills from a skills CLI source and marks installed project skills', async () => {
    await mkdir(path.join(workspace, '.ai', 'skills', 'internal-review'), { recursive: true })
    await writeFile(
      path.join(workspace, '.ai', 'skills', 'internal-review', 'SKILL.md'),
      '---\nname: internal-review\ndescription: review skill\n---\nReview skill body\n'
    )

    createExecImplementation(() => ({
      stdout: [
        '  internal-review - Review code with internal checklists.',
        '  docs-writer - Write release docs with internal templates.'
      ].join('\n')
    }))

    const { searchSkillsCliSource } = await import('#~/services/skill-hub/skills-cli.js')
    await expect(searchSkillsCliSource({
      config: {
        package: '@byted/skills',
        registry: 'https://registry.example.com',
        version: 'latest',
        env: {
          SKILLS_REGION: 'cn'
        }
      },
      registry: 'https://registry.example.com',
      query: 'review',
      source: 'example-source/default/public',
      workspaceFolder: workspace
    })).resolves.toEqual({
      source: 'example-source/default/public',
      hasMore: false,
      total: 2,
      items: [
        expect.objectContaining({
          registry: 'skills-cli',
          name: 'internal-review',
          installed: true,
          installRef: 'internal-review',
          source: 'example-source/default/public'
        })
      ]
    })

    expect(mocks.ensureManagedNpmCli).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        source: 'managed',
        package: '@byted/skills',
        version: 'latest'
      }),
      cwd: expect.stringContaining('vf-skills-cli-list-'),
      env: expect.objectContaining({
        npm_config_registry: 'https://registry.example.com',
        SKILLS_REGION: 'cn'
      }),
      installKey: ['registry', 'https://registry.example.com']
    }))
  })

  it('installs a selected skill into project .ai/skills via the skills CLI', async () => {
    createExecImplementation(async (args, options) => {
      if (!args.includes('--skill')) {
        return new Error(`Unexpected skills CLI args: ${args.join(' ')}`)
      }

      const skillDir = path.join(String(options.cwd), '.agents', 'skills', 'internal-review')
      await mkdir(skillDir, { recursive: true })
      await writeFile(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: internal-review\ndescription: review skill\n---\nReview skill body\n'
      )
      await writeFile(path.join(skillDir, 'notes.md'), 'supporting file\n')

      return {
        stdout: 'installed\n'
      }
    })

    const { installSkillsCliSkill } = await import('#~/services/skill-hub/skills-cli.js')
    const result = await installSkillsCliSkill({
      config: {
        registry: 'https://registry.example.com'
      },
      skill: 'internal-review',
      source: 'example-source/default/public',
      workspaceFolder: workspace
    })

    expect(result).toEqual(expect.objectContaining({
      source: 'example-source/default/public',
      skill: 'internal-review',
      name: 'internal-review'
    }))
    await expect(
      readFile(path.join(workspace, '.ai', 'skills', 'internal-review', 'SKILL.md'), 'utf8')
    ).resolves.toContain('Review skill body')
    await expect(
      readFile(path.join(workspace, '.ai', 'skills', 'internal-review', 'notes.md'), 'utf8')
    ).resolves.toContain('supporting file')
  })

  it('reports the force flag name when the target skill is already installed', async () => {
    await mkdir(path.join(workspace, '.ai', 'skills', 'internal-review'), { recursive: true })
    await writeFile(
      path.join(workspace, '.ai', 'skills', 'internal-review', 'SKILL.md'),
      '---\nname: internal-review\n---\nReview skill body\n'
    )

    createExecImplementation(async (args, options) => {
      if (!args.includes('--skill')) {
        return new Error(`Unexpected skills CLI args: ${args.join(' ')}`)
      }

      const skillDir = path.join(String(options.cwd), '.agents', 'skills', 'internal-review')
      await mkdir(skillDir, { recursive: true })
      await writeFile(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: internal-review\n---\nReview skill body\n'
      )

      return {
        stdout: 'installed\n'
      }
    })

    const { installSkillsCliSkill } = await import('#~/services/skill-hub/skills-cli.js')
    await expect(installSkillsCliSkill({
      config: {
        registry: 'https://registry.example.com'
      },
      skill: 'internal-review',
      source: 'example-source/default/public',
      workspaceFolder: workspace
    })).rejects.toThrow('Use --force to replace it.')
  })
})
