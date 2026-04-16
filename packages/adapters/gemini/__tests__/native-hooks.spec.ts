import { PassThrough } from 'node:stream'

import { describe, expect, it, vi } from 'vitest'

import type { AdapterCtx } from '@vibe-forge/types'

import { buildGeminiNativeHooksSettings, prepareGeminiNativeHooks } from '../src/runtime/native-hooks'

const createCtx = (env: Record<string, string | undefined> = {}): AdapterCtx =>
  ({
    ctxId: 'ctx-gemini-hooks',
    cwd: '/tmp/project',
    env,
    cache: {
      get: async () => undefined,
      set: async () => ({ cachePath: '/tmp/project/.ai/cache/base.json' })
    },
    logger: {
      stream: new PassThrough(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    },
    configs: [undefined, undefined],
    assets: {
      cwd: '/tmp/project',
      pluginInstances: [],
      assets: [],
      rules: [],
      specs: [],
      entities: [],
      skills: [],
      mcpServers: {},
      hookPlugins: [{ id: 'hookPlugin:workspace:logger' } as never],
      opencodeOverlayAssets: [],
      defaultIncludeMcpServers: [],
      defaultExcludeMcpServers: []
    }
  }) as AdapterCtx

describe('gemini native hook bridge', () => {
  it('prepares the managed hook runtime and marks native hooks available', () => {
    const ctx = createCtx()

    expect(prepareGeminiNativeHooks(ctx)).toBe(true)
    expect(ctx.env.__VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__).toBe('1')
    expect(ctx.env.__VF_PROJECT_AI_GEMINI_HOOK_COMMAND__).toContain('call-hook.js')
    expect(ctx.env.__VF_PROJECT_NODE_PATH__).toBe(process.execPath)
    expect(ctx.env.__VF_PROJECT_WORKSPACE_FOLDER__).toBe(ctx.cwd)
  })

  it('builds Gemini native hook settings with managed event groups', () => {
    const settings = buildGeminiNativeHooksSettings({
      __VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__: '1',
      __VF_PROJECT_AI_GEMINI_HOOK_COMMAND__: `"${process.execPath}" "/tmp/call-hook.js"`
    })

    expect(settings).toMatchObject({
      hooksConfig: {
        enabled: true
      },
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                command: `"${process.execPath}" "/tmp/call-hook.js"`,
                type: 'command'
              }
            ]
          }
        ],
        BeforeTool: [
          {
            matcher: '.*'
          }
        ],
        PreCompress: [
          {
            hooks: [
              {
                command: `"${process.execPath}" "/tmp/call-hook.js"`
              }
            ]
          }
        ],
        AfterAgent: [
          {
            hooks: [
              {
                command: `"${process.execPath}" "/tmp/call-hook.js"`
              }
            ]
          }
        ]
      }
    })
  })
})
