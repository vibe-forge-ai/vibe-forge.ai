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

  it('omits route-only skills when the resolved adapter provides native project skills', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai.config.json'),
      JSON.stringify(
        {
          adapters: {
            'claude-code': {},
            codex: {}
          },
          modelServices: {
            gpt: {
              apiBaseUrl: 'https://example.invalid/responses',
              apiKey: 'demo',
              models: ['kimi-k2.5']
            }
          },
          models: {
            'gpt,kimi-k2.5': {
              defaultAdapter: 'claude-code'
            }
          }
        },
        null,
        2
      )
    )
    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      '---\ndescription: 检索资料\n---\n阅读 README.md'
    )

    const [, resolvedConfig] = await generateAdapterQueryOptions(
      undefined,
      undefined,
      workspace,
      {
        model: 'gpt,kimi-k2.5'
      }
    )

    expect(resolvedConfig.systemPrompt).not.toContain('<skills>')
    expect(resolvedConfig.systemPrompt).not.toContain('# research')
    expect(resolvedConfig.systemPrompt).not.toContain('Skill file path: .ai/skills/research/SKILL.md')
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

  it('loads route skills from injected plugin packages', async () => {
    const workspace = await createWorkspace()
    const pluginDir = join(workspace, 'node_modules', '@vibe-forge', 'plugin-cli-skills')

    await writeDocument(
      join(pluginDir, 'package.json'),
      JSON.stringify(
        {
          name: '@vibe-forge/plugin-cli-skills',
          version: '1.0.0'
        },
        null,
        2
      )
    )
    await writeDocument(
      join(pluginDir, 'skills', 'vf-cli-quickstart', 'SKILL.md'),
      '---\ndescription: CLI 快速入门\n---\n先执行 vf list 再恢复会话'
    )

    const [, resolvedConfig] = await generateAdapterQueryOptions(
      undefined,
      undefined,
      workspace,
      {
        plugins: [
          {
            id: '@vibe-forge/plugin-cli-skills'
          }
        ]
      }
    )

    expect(resolvedConfig.systemPrompt).toContain('<skills>')
    expect(resolvedConfig.systemPrompt).toContain('# vf-cli-quickstart')
    expect(resolvedConfig.systemPrompt).toContain('> Skill description: CLI 快速入门')
  })

  it('adds configured workspace routes to the default system prompt', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai.config.json'),
      JSON.stringify(
        {
          workspaces: {
            include: ['services/*']
          }
        },
        null,
        2
      )
    )
    await writeDocument(join(workspace, 'services/billing/README.md'), '# billing\n')

    const [, resolvedConfig] = await generateAdapterQueryOptions(
      undefined,
      undefined,
      workspace
    )

    expect(resolvedConfig.systemPrompt).toContain('The project includes the following registered workspaces')
    expect(resolvedConfig.systemPrompt).toContain('Identifier: billing')
    expect(resolvedConfig.systemPrompt).toContain('type: "workspace"')
  })

  it('loads task assets from the selected workspace target', async () => {
    const workspace = await createWorkspace()

    await writeDocument(
      join(workspace, '.ai.config.json'),
      JSON.stringify(
        {
          workspaces: {
            include: ['services/*']
          }
        },
        null,
        2
      )
    )
    await writeDocument(join(workspace, 'services/billing/.ai/rules/always.md'), '---\nalways: true\n---\nBilling rule')

    const [, resolvedConfig] = await generateAdapterQueryOptions(
      'workspace',
      'billing',
      workspace
    )

    expect(resolvedConfig.workspace?.path).toBe('services/billing')
    expect(resolvedConfig.systemPrompt).toContain('Billing rule')
  })

  it('merges injected plugins with workspace config plugins in the returned asset bundle', async () => {
    const workspace = await createWorkspace()
    const cliPluginDir = join(workspace, 'node_modules', '@vibe-forge', 'plugin-cli-skills')
    const loggerPluginDir = join(workspace, 'node_modules', '@vibe-forge', 'plugin-logger')

    await writeDocument(
      join(workspace, '.ai.config.json'),
      JSON.stringify(
        {
          plugins: [
            {
              id: 'logger'
            }
          ]
        },
        null,
        2
      )
    )
    await writeDocument(
      join(cliPluginDir, 'package.json'),
      JSON.stringify(
        {
          name: '@vibe-forge/plugin-cli-skills',
          version: '1.0.0'
        },
        null,
        2
      )
    )
    await writeDocument(
      join(cliPluginDir, 'skills', 'vf-cli-quickstart', 'SKILL.md'),
      '---\ndescription: CLI 快速入门\n---\n先执行 vf list 再恢复会话'
    )
    await writeDocument(
      join(loggerPluginDir, 'package.json'),
      JSON.stringify(
        {
          name: '@vibe-forge/plugin-logger',
          version: '1.0.0'
        },
        null,
        2
      )
    )
    await writeDocument(
      join(loggerPluginDir, 'hooks.js'),
      'module.exports = { TaskStart: async (_ctx, _input, next) => next() }\n'
    )

    const [, resolvedConfig] = await generateAdapterQueryOptions(
      undefined,
      undefined,
      workspace,
      {
        plugins: [
          {
            id: '@vibe-forge/plugin-cli-skills'
          }
        ]
      }
    )

    expect(resolvedConfig.assetBundle?.pluginConfigs).toEqual([
      { id: 'logger' },
      { id: '@vibe-forge/plugin-cli-skills' }
    ])
    expect(resolvedConfig.assetBundle?.hookPlugins.map(asset => asset.packageId)).toEqual([
      '@vibe-forge/plugin-logger'
    ])
  })
})
