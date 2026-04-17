import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const tempDirs: string[] = []
const cliPath = path.resolve(process.cwd(), 'apps/cli/cli.js')

const createTempDir = async () => {
  const cwd = await fs.realpath(
    await fs.mkdtemp(path.join(tmpdir(), 'vf-config-command-'))
  )
  tempDirs.push(cwd)
  return cwd
}

const runCli = (
  cwd: string,
  args: string[],
  options: {
    input?: string
  } = {}
) =>
  spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    input: options.input
  })

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })))
})

describe('config command', () => {
  it('lists merged section presence by default in json mode', async () => {
    const cwd = await createTempDir()

    await fs.writeFile(
      path.join(cwd, '.ai.config.json'),
      JSON.stringify({
        defaultModel: 'project-model',
        adapters: {
          codex: {
            defaultModel: 'gpt-5'
          }
        }
      })
    )
    await fs.writeFile(
      path.join(cwd, '.ai.dev.config.json'),
      JSON.stringify({
        permissions: {
          allow: ['Read']
        }
      })
    )

    const result = runCli(cwd, ['config', 'list', '--json'])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toEqual({
      ok: true,
      workspaceFolder: cwd,
      sections: {
        general: true,
        conversation: false,
        models: false,
        modelServices: false,
        channels: false,
        adapters: true,
        plugins: false,
        mcp: false,
        shortcuts: false
      }
    })
  })

  it('lists merged config subtrees by path in json mode', async () => {
    const cwd = await createTempDir()

    await fs.writeFile(
      path.join(cwd, '.ai.config.json'),
      JSON.stringify({
        models: {
          'gpt-4.1': {
            title: 'Project Title'
          }
        }
      })
    )
    await fs.writeFile(
      path.join(cwd, '.ai.dev.config.json'),
      JSON.stringify({
        models: {
          'gpt-5.4': {
            title: 'User Title'
          }
        }
      })
    )

    const result = runCli(cwd, ['config', 'list', '--json', 'models'])

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({
      ok: true,
      workspaceFolder: cwd,
      source: 'merged',
      path: 'models',
      section: 'models',
      value: {
        'gpt-4.1': {
          title: 'Project Title'
        },
        'gpt-5.4': {
          title: 'User Title'
        }
      }
    })
  })

  it('reads merged config values in json mode', async () => {
    const cwd = await createTempDir()

    await fs.writeFile(
      path.join(cwd, '.ai.config.json'),
      JSON.stringify({
        defaultModel: 'project-model',
        models: {
          'gpt-4.1': {
            title: 'Project Title'
          }
        }
      })
    )
    await fs.writeFile(
      path.join(cwd, '.ai.dev.config.json'),
      JSON.stringify({
        defaultModel: 'user-model'
      })
    )

    const defaultModelResult = runCli(cwd, ['config', 'get', 'defaultModel', '--json'])
    expect(defaultModelResult.status).toBe(0)
    expect(JSON.parse(defaultModelResult.stdout)).toEqual({
      ok: true,
      workspaceFolder: cwd,
      source: 'merged',
      path: 'general.defaultModel',
      section: 'general',
      value: 'user-model'
    })

    const exactPathResult = runCli(cwd, ['config', 'get', '["models","gpt-4.1","title"]', '--json'])
    expect(exactPathResult.status).toBe(0)
    expect(JSON.parse(exactPathResult.stdout)).toEqual({
      ok: true,
      workspaceFolder: cwd,
      source: 'merged',
      path: 'models.gpt-4.1.title',
      section: 'models',
      value: 'Project Title'
    })
  })

  it('prints yaml values in text mode for read commands', async () => {
    const cwd = await createTempDir()

    await fs.writeFile(
      path.join(cwd, '.ai.config.json'),
      JSON.stringify({
        models: {
          'gpt-4.1': {
            title: 'Project Title'
          }
        }
      })
    )
    await fs.writeFile(
      path.join(cwd, '.ai.dev.config.json'),
      JSON.stringify({
        models: {
          'gpt-5.4': {
            title: 'User Title'
          }
        }
      })
    )

    const expectedModelsOutput = `gpt-4.1:\n  title: Project Title\ngpt-5.4:\n  title: User Title\n`

    const getResult = runCli(cwd, ['config', 'get', 'models'])
    expect(getResult.status).toBe(0)
    expect(getResult.stderr).toBe('')
    expect(getResult.stdout).toBe(expectedModelsOutput)

    const listResult = runCli(cwd, ['config', 'list', 'models'])
    expect(listResult.status).toBe(0)
    expect(listResult.stderr).toBe('')
    expect(listResult.stdout).toBe(expectedModelsOutput)
  })

  it('expands models by service in text mode when model services are configured', async () => {
    const cwd = await createTempDir()

    await fs.writeFile(
      path.join(cwd, '.ai.config.json'),
      JSON.stringify({
        modelServices: {
          'gpt-responses': {
            apiBaseUrl: 'https://example.com/responses',
            apiKey: 'demo-key',
            models: ['gpt-5.4', 'gpt-5.2']
          }
        },
        models: {
          'gpt-responses,gpt-5.4': {
            description: 'Structured output first.'
          },
          'gpt-5.4': {
            effort: 'max'
          }
        }
      })
    )

    const result = runCli(cwd, ['config', 'get', 'models'])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe(
      'gpt-responses:\n' +
        '  gpt-5.4:\n' +
        '    selector: gpt-responses,gpt-5.4\n' +
        '    effort: max\n' +
        '    description: Structured output first.\n' +
        '  gpt-5.2:\n' +
        '    selector: gpt-responses,gpt-5.2\n'
    )
  })

  it('updates config values from argv and stdin in json mode', async () => {
    const cwd = await createTempDir()

    const stringResult = runCli(cwd, [
      'config',
      'set',
      'general.defaultModel',
      'gpt-5.4',
      '--type',
      'string',
      '--json'
    ])

    expect(stringResult.status).toBe(0)
    expect(JSON.parse(stringResult.stdout)).toEqual({
      ok: true,
      workspaceFolder: cwd,
      source: 'project',
      path: 'general.defaultModel',
      section: 'general',
      configPath: path.join(cwd, '.ai.config.json'),
      value: 'gpt-5.4'
    })
    expect(JSON.parse(await fs.readFile(path.join(cwd, '.ai.config.json'), 'utf8'))).toEqual({
      defaultModel: 'gpt-5.4'
    })

    const stdinResult = runCli(cwd, [
      'config',
      'set',
      'general.permissions',
      '--type',
      'json',
      '--json'
    ], {
      input: '{"allow":["Read"]}'
    })

    expect(stdinResult.status).toBe(0)
    expect(JSON.parse(stdinResult.stdout)).toEqual({
      ok: true,
      workspaceFolder: cwd,
      source: 'project',
      path: 'general.permissions',
      section: 'general',
      configPath: path.join(cwd, '.ai.config.json'),
      value: {
        allow: ['Read']
      }
    })
    expect(JSON.parse(await fs.readFile(path.join(cwd, '.ai.config.json'), 'utf8'))).toEqual({
      defaultModel: 'gpt-5.4',
      permissions: {
        allow: ['Read']
      }
    })
  })

  it('removes nested values and whole sections in json mode', async () => {
    const cwd = await createTempDir()

    await fs.writeFile(
      path.join(cwd, '.ai.config.json'),
      JSON.stringify({
        defaultModel: 'gpt-5.4',
        permissions: {
          allow: ['Read']
        },
        plugins: [
          {
            id: 'demo'
          }
        ],
        marketplaces: {
          team: {
            type: 'claude-code'
          }
        }
      })
    )

    const unsetFieldResult = runCli(cwd, [
      'config',
      'unset',
      'general.defaultModel',
      '--json'
    ])

    expect(unsetFieldResult.status).toBe(0)
    expect(JSON.parse(unsetFieldResult.stdout)).toEqual({
      ok: true,
      workspaceFolder: cwd,
      source: 'project',
      path: 'general.defaultModel',
      section: 'general',
      configPath: path.join(cwd, '.ai.config.json'),
      removed: true
    })

    const unsetNestedResult = runCli(cwd, [
      'config',
      'unset',
      'general.permissions.allow',
      '--json'
    ])

    expect(unsetNestedResult.status).toBe(0)
    expect(JSON.parse(unsetNestedResult.stdout)).toEqual({
      ok: true,
      workspaceFolder: cwd,
      source: 'project',
      path: 'general.permissions.allow',
      section: 'general',
      configPath: path.join(cwd, '.ai.config.json'),
      removed: true
    })

    const unsetSectionResult = runCli(cwd, [
      'config',
      'unset',
      'plugins',
      '--json'
    ])

    expect(unsetSectionResult.status).toBe(0)
    expect(JSON.parse(unsetSectionResult.stdout)).toEqual({
      ok: true,
      workspaceFolder: cwd,
      source: 'project',
      path: 'plugins',
      section: 'plugins',
      configPath: path.join(cwd, '.ai.config.json'),
      removed: true
    })

    expect(JSON.parse(await fs.readFile(path.join(cwd, '.ai.config.json'), 'utf8'))).toEqual({
      permissions: {}
    })
  })
})
