import { describe, expect, it } from 'vitest'

import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV } from '@vibe-forge/hooks'
import type { AdapterCtx, Config } from '@vibe-forge/types'

import { resolveGeminiBinaryPath } from '#~/paths.js'
import { buildGeminiNativeHooksSettings } from '#~/runtime/native-hooks.js'
import {
  buildGeminiDirectArgs,
  buildGeminiRunArgs,
  buildGeminiSettings,
  buildGeminiSpawnEnv,
  ensureGeminiPromptSize,
  normalizeGeminiPrompt,
  normalizeGeminiToolName,
  prefixGeminiToolName,
  resolveGeminiApprovalMode,
  resolveGeminiModel,
  validateGeminiSelection
} from '#~/runtime/shared.js'

const createCtx = (config?: Config, userConfig?: Config, env: Record<string, string | undefined> = {}) => ({
  ctxId: 'ctx-1',
  cwd: '/tmp/project',
  env,
  cache: {
    get: async () => undefined,
    set: async () => ({ cachePath: '/tmp/project/.ai/cache/test.json' })
  },
  logger: {
    stream: undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined
  },
  configs: [config, userConfig]
}) as unknown as AdapterCtx

describe('resolveGeminiBinaryPath', () => {
  it('returns the env-specified path when set', () => {
    expect(resolveGeminiBinaryPath({
      __VF_PROJECT_AI_ADAPTER_GEMINI_CLI_PATH__: '/usr/local/bin/gemini'
    })).toBe('/usr/local/bin/gemini')
  })
})

describe('gemini prompt and settings helpers', () => {
  it('normalizes prompt content into plain text', () => {
    expect(normalizeGeminiPrompt([
      { type: 'text', text: 'Review this change' },
      { type: 'file', path: '/tmp/project/README.md' },
      { type: 'image', url: 'file:///tmp/project/screenshot.png' }
    ])).toBe([
      'Review this change',
      'Attached file: /tmp/project/README.md',
      'Attached image: file:///tmp/project/screenshot.png'
    ].join('\n\n'))
  })

  it('maps approval modes and managed CLI args', () => {
    expect(resolveGeminiApprovalMode('acceptEdits')).toBe('auto_edit')
    expect(resolveGeminiApprovalMode('plan')).toBe('plan')
    expect(resolveGeminiApprovalMode('bypassPermissions')).toBe('yolo')
    expect(buildGeminiRunArgs({
      approvalMode: 'plan',
      model: 'gemini-2.5-pro',
      resumeSessionId: 'session-123'
    })).toEqual([
      '--output-format',
      'stream-json',
      '--model',
      'gemini-2.5-pro',
      '--resume',
      'session-123',
      '--approval-mode',
      'plan'
    ])
    expect(buildGeminiDirectArgs({
      approvalMode: 'default',
      model: 'kimi-k2.5',
      prompt: 'hi'
    })).toEqual([
      '--model',
      'kimi-k2.5',
      '--approval-mode',
      'default',
      '--prompt-interactive',
      'hi'
    ])
  })

  it('builds isolated Gemini settings with native context files and MCP config', () => {
    expect(buildGeminiSettings({
      adapterConfig: {},
      approvalMode: 'default',
      generatedContextFileName: '.ai/.mock/.gemini-adapter/session-1/VIBE_FORGE.md',
      mcpServers: {
        docs: {
          command: 'node',
          args: ['tools/docs-mcp.js'],
          env: {
            DOCS_TOKEN: 'token'
          }
        },
        browser: {
          type: 'http',
          url: 'https://example.com/mcp',
          headers: {
            Authorization: 'Bearer token'
          }
        }
      },
      model: 'gemini-2.5-pro'
    })).toMatchObject({
      model: {
        name: 'gemini-2.5-pro'
      },
      general: {
        defaultApprovalMode: 'default',
        enableAutoUpdate: false,
        enableAutoUpdateNotification: false
      },
      experimental: {
        enableAgents: false
      },
      admin: {
        extensions: {
          enabled: false
        }
      },
      telemetry: {
        enabled: false,
        logPrompts: false
      },
      privacy: {
        usageStatisticsEnabled: false
      },
      context: {
        fileName: ['GEMINI.md', '.ai/.mock/.gemini-adapter/session-1/VIBE_FORGE.md']
      },
      mcpServers: {
        docs: {
          command: 'node',
          args: ['tools/docs-mcp.js']
        },
        browser: {
          httpUrl: 'https://example.com/mcp'
        }
      }
    })
  })

  it('enables gateway auth when routing through an external model service', () => {
    expect(buildGeminiSettings({
      adapterConfig: {},
      approvalMode: 'default',
      externalAuth: true,
      mcpServers: {},
      model: 'kimi-k2.5'
    })).toMatchObject({
      model: {
        name: 'kimi-k2.5'
      },
      security: {
        auth: {
          selectedType: 'gateway',
          useExternal: true
        }
      }
    })
  })

  it('normalizes tool names to the adapter namespace', () => {
    expect(normalizeGeminiToolName('run_shell_command')).toBe('RunShellCommand')
    expect(prefixGeminiToolName('web_search')).toBe('adapter:gemini:WebSearch')
  })

  it('rejects prompts that exceed the Gemini stdin limit', () => {
    expect(() => ensureGeminiPromptSize('x'.repeat((8 * 1024 * 1024) + 1))).toThrow(/stdin limit/)
  })

  it('injects the local Gemini gateway base URL for external services', () => {
    expect(buildGeminiSpawnEnv({
      adapterConfig: {},
      ctx: createCtx(),
      proxyBaseUrl: 'http://127.0.0.1:3000/route'
    }).GOOGLE_GEMINI_BASE_URL).toBe('http://127.0.0.1:3000/route')
  })

  it('writes native hooks into managed Gemini settings when enabled', () => {
    const nativeHooks = buildGeminiNativeHooksSettings({
      __VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__: '1',
      __VF_PROJECT_AI_GEMINI_HOOK_COMMAND__: `"${process.execPath}" "/tmp/call-hook.js"`
    })

    expect(buildGeminiSettings({
      adapterConfig: {},
      approvalMode: 'default',
      mcpServers: {},
      model: 'gemini-2.5-pro',
      nativeHooks
    })).toMatchObject({
      hooksConfig: {
        enabled: true
      },
      hooks: {
        BeforeTool: [
          {
            matcher: '.*',
            hooks: [
              {
                command: `"${process.execPath}" "/tmp/call-hook.js"`,
                type: 'command'
              }
            ]
          }
        ],
        AfterAgent: [
          {
            hooks: [
              {
                command: `"${process.execPath}" "/tmp/call-hook.js"`,
                type: 'command'
              }
            ]
          }
        ]
      }
    })
  })

  it('passes native hook bridge markers to Gemini child processes when enabled', () => {
    const env = buildGeminiSpawnEnv({
      adapterConfig: {},
      ctx: createCtx(undefined, undefined, {
        __VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__: '1'
      }),
      model: 'kimi-k2.5',
      runtime: 'cli',
      sessionId: 'session-gemini-native'
    })

    expect(env.__VF_VIBE_FORGE_GEMINI_HOOKS_ACTIVE__).toBe('1')
    expect(env.__VF_GEMINI_HOOK_MODEL__).toBe('kimi-k2.5')
    expect(env.__VF_GEMINI_HOOK_RUNTIME__).toBe('cli')
    expect(env.__VF_GEMINI_TASK_SESSION_ID__).toBe('session-gemini-native')
    expect(env[NATIVE_HOOK_BRIDGE_ADAPTER_ENV]).toBe('gemini')
  })
})

describe('validateGeminiSelection', () => {
  it('accepts chat-completions model services and resolves them for Gemini CLI', () => {
    const ctx = createCtx({
      adapters: {
        gemini: {}
      },
      modelServices: {
        kimi: {
          apiBaseUrl: 'https://api.moonshot.ai/v1/chat/completions',
          apiKey: 'secret',
          models: ['kimi-k2.5']
        }
      }
    })

    expect(() => validateGeminiSelection({
      ctx,
      model: 'kimi,kimi-k2.5'
    })).not.toThrow()

    expect(resolveGeminiModel({
      ctx,
      model: 'kimi,kimi-k2.5'
    })).toMatchObject({
      cliModel: 'kimi-k2.5',
      routedService: {
        serviceKey: 'kimi',
        endpoint: 'https://api.moonshot.ai/v1/chat/completions',
        model: 'kimi-k2.5'
      }
    })
  })

  it('rejects service selectors that point to responses-style endpoints', () => {
    expect(() => validateGeminiSelection({
      ctx: createCtx({
        adapters: {
          gemini: {}
        },
        modelServices: {
          openai: {
            apiBaseUrl: 'https://example.com/v1/responses',
            apiKey: 'secret',
            models: ['gpt-5.4']
          }
        }
      }),
      model: 'openai,gpt-5.4'
    })).toThrow(/chat\/completions/)
  })

  it('rejects service selectors that point to unknown services', () => {
    expect(() => validateGeminiSelection({
      ctx: createCtx({
        adapters: {
          gemini: {}
        }
      }),
      model: 'missing,kimi-k2.5'
    })).toThrow(/could not find model service/)
  })

  it('rejects forbidden native prompt commands by default', () => {
    const ctx = createCtx({
      adapters: {
        gemini: {}
      }
    })

    expect(() => validateGeminiSelection({
      ctx,
      prompt: '/resume latest'
    })).toThrow(/slash commands/)

    expect(() => validateGeminiSelection({
      ctx,
      prompt: 'read @./README.md before continuing'
    })).toThrow(/@path/)
  })

  it('allows prompt commands when explicitly enabled', () => {
    expect(() => validateGeminiSelection({
      ctx: createCtx({
        adapters: {
          gemini: {
            nativePromptCommands: 'allow'
          }
        }
      }),
      prompt: '/resume latest'
    })).not.toThrow()
  })

  it('rejects unsupported extra options and sandbox env', () => {
    expect(() => validateGeminiSelection({
      ctx: createCtx({
        adapters: {
          gemini: {}
        }
      }, undefined, {
        GEMINI_SANDBOX: 'docker'
      }),
      extraOptions: ['--log-level', 'debug']
    })).toThrow(/GEMINI_SANDBOX/)

    expect(() => validateGeminiSelection({
      ctx: createCtx({
        adapters: {
          gemini: {}
        }
      }),
      extraOptions: ['--sandbox']
    })).toThrow(/extra option/)
  })

  it('rejects unsupported adapter host/provider keys', () => {
    expect(() => validateGeminiSelection({
      ctx: createCtx({
        adapters: {
          gemini: {
            apiHost: 'https://example.com'
          } as Record<string, unknown>
        }
      })
    })).toThrow(/apiHost/)
  })
})
