import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildChildEnv } from '#~/runtime/session/child-env.js'
import { resolveAdapterConfig } from '#~/runtime/session/shared.js'

import {
  createWorkspace,
  makeCtx,
  registerRuntimeTestHooks,
  writeDocument
} from './runtime-test-helpers'

describe('opencode resolved config consumption', () => {
  registerRuntimeTestHooks()

  it('applies merged default MCP selection through buildChildEnv', async () => {
    const workspace = await createWorkspace()
    const baseConfigDir = join(workspace, 'user-opencode-config')
    await writeDocument(join(baseConfigDir, 'opencode.json'), '{}\n')

    const { ctx } = makeCtx({
      cwd: workspace,
      env: {
        OPENCODE_CONFIG_DIR: baseConfigDir
      },
      configs: [{
        mcpServers: {
          docs: { command: 'npx', args: ['docs-server'] },
          jira: { type: 'http', url: 'https://example.test/mcp' },
          browser: { command: 'npx', args: ['browser-server'] }
        },
        defaultIncludeMcpServers: ['docs', 'jira'],
        defaultExcludeMcpServers: ['jira']
      }, undefined]
    })

    const childEnv = await buildChildEnv({
      ctx: ctx as any,
      options: {
        type: 'create',
        runtime: 'server',
        sessionId: 'session-mcp',
        onEvent: () => {}
      } as any,
      adapterConfig: resolveAdapterConfig(ctx as any)
    })

    const configDir = childEnv.env.OPENCODE_CONFIG_DIR
    const sessionConfig = JSON.parse(
      typeof configDir === 'string'
        ? await readFile(join(configDir, 'opencode.json'), 'utf8')
        : '{}'
    ) as {
      mcp?: Record<string, unknown>
    }

    expect(Object.keys(sessionConfig.mcp ?? {})).toEqual(['docs'])
  })

  it('applies merged adapter effort while preserving native configContent effort', async () => {
    const workspace = await createWorkspace()
    const baseConfigDir = join(workspace, 'user-opencode-config')
    await writeDocument(join(baseConfigDir, 'opencode.json'), '{}\n')

    const { ctx } = makeCtx({
      cwd: workspace,
      env: {
        OPENCODE_CONFIG_DIR: baseConfigDir
      },
      configs: [{
        adapters: {
          opencode: {
            effort: 'high',
            configContent: {
              provider: {
                openai: {
                  models: {
                    'gpt-5': {
                      options: {
                        reasoningEffort: 'xhigh'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }, undefined]
    })

    const childEnv = await buildChildEnv({
      ctx: ctx as any,
      options: {
        type: 'create',
        runtime: 'server',
        sessionId: 'session-effort',
        model: 'openai/gpt-5',
        onEvent: () => {}
      } as any,
      adapterConfig: resolveAdapterConfig(ctx as any)
    })

    const configDir = childEnv.env.OPENCODE_CONFIG_DIR
    const sessionConfig = JSON.parse(
      typeof configDir === 'string'
        ? await readFile(join(configDir, 'opencode.json'), 'utf8')
        : '{}'
    ) as {
      provider?: {
        openai?: {
          models?: {
            'gpt-5'?: {
              options?: {
                reasoningEffort?: string
              }
            }
          }
        }
      }
    }

    expect(childEnv.effort).toBe('max')
    expect(sessionConfig.provider?.openai?.models?.['gpt-5']?.options?.reasoningEffort).toBe('xhigh')
  })

  it('prefers precomputed configState over stale raw config pairs', async () => {
    const workspace = await createWorkspace()
    const baseConfigDir = join(workspace, 'user-opencode-config')
    await writeDocument(join(baseConfigDir, 'opencode.json'), '{}\n')

    const { ctx } = makeCtx({
      cwd: workspace,
      env: {
        OPENCODE_CONFIG_DIR: baseConfigDir
      },
      configs: [{
        adapters: {
          opencode: {
            effort: 'low'
          }
        },
        mcpServers: {
          jira: { type: 'http', url: 'https://example.test/mcp' }
        },
        defaultIncludeMcpServers: ['jira']
      }, undefined]
    })
    ctx.configState = {
      projectConfig: undefined,
      userConfig: undefined,
      mergedConfig: {
        adapters: {
          opencode: {
            effort: 'high'
          }
        },
        mcpServers: {
          docs: { command: 'npx', args: ['docs-server'] },
          jira: { type: 'http', url: 'https://example.test/mcp' }
        },
        defaultIncludeMcpServers: ['docs']
      }
    }

    const adapterConfig = resolveAdapterConfig(ctx as any)
    const childEnv = await buildChildEnv({
      ctx: ctx as any,
      options: {
        type: 'create',
        runtime: 'server',
        sessionId: 'session-config-state',
        onEvent: () => {}
      } as any,
      adapterConfig
    })

    const configDir = childEnv.env.OPENCODE_CONFIG_DIR
    const sessionConfig = JSON.parse(
      typeof configDir === 'string'
        ? await readFile(join(configDir, 'opencode.json'), 'utf8')
        : '{}'
    ) as {
      mcp?: Record<string, unknown>
    }

    expect(adapterConfig.common.effort).toBe('high')
    expect(Object.keys(sessionConfig.mcp ?? {})).toEqual(['docs'])
  })
})
