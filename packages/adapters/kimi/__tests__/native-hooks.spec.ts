import '../src/adapter-config'

import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PassThrough } from 'node:stream'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveKimiSessionBase } from '../src/runtime/config'
import {
  buildKimiNativeHookEntries,
  mergeKimiNativeHooksIntoJsonConfig,
  mergeKimiNativeHooksIntoTomlConfig,
  prepareKimiNativeHooks
} from '../src/runtime/native-hooks'

import type { AdapterCtx } from '@vibe-forge/types'

const tempDirs: string[] = []

const createTempDir = async (prefix: string) => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

const createCtx = async (overrides: Partial<AdapterCtx> = {}): Promise<AdapterCtx> => {
  const cwd = overrides.cwd ?? await createTempDir('vf-kimi-hooks-')
  return {
    ctxId: 'ctx-kimi-hooks',
    cwd,
    env: {},
    cache: {
      set: async () => ({ cachePath: join(cwd, '.ai', 'cache', 'base.json') }),
      get: async () => undefined
    },
    logger: {
      stream: new PassThrough(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    },
    configs: [{
      modelServices: {
        gateway: {
          apiBaseUrl: 'https://api.openai.com/v1',
          apiKey: 'token',
          models: ['gpt-5']
        }
      }
    }, undefined],
    assets: {
      cwd,
      pluginInstances: [],
      assets: [],
      rules: [],
      specs: [],
      entities: [],
      skills: [],
      workspaces: [],
      mcpServers: {},
      hookPlugins: [{ id: 'hookPlugin:workspace:logger' } as never],
      opencodeOverlayAssets: [],
      defaultIncludeMcpServers: [],
      defaultExcludeMcpServers: []
    },
    ...overrides
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('kimi native hook bridge', () => {
  it('prepares the managed hook runtime and marks native hooks available', async () => {
    const ctx = await createCtx()

    expect(prepareKimiNativeHooks(ctx)).toBe(true)
    expect(ctx.env.__VF_PROJECT_AI_KIMI_NATIVE_HOOKS_AVAILABLE__).toBe('1')
    expect(ctx.env.__VF_PROJECT_AI_KIMI_HOOK_COMMAND__).toContain('kimi-hook.js')
    expect(ctx.env.__VF_PROJECT_NODE_PATH__).toBe(process.execPath)
    expect(ctx.env.__VF_PROJECT_WORKSPACE_FOLDER__).toBe(ctx.cwd)
  })

  it('merges managed Kimi hook entries into JSON config without duplicating old managed entries', () => {
    const command = `"${process.execPath}" "/tmp/kimi-hook.js"`
    const merged = mergeKimiNativeHooksIntoJsonConfig({
      config: {
        hooks: [
          { event: 'PreToolUse', command: 'user-protect.sh' },
          { event: 'PreToolUse', command: 'node /tmp/kimi-hook.js' }
        ]
      },
      enabled: true,
      command
    })

    expect(merged.hooks).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'PreToolUse', command: 'user-protect.sh' }),
      expect.objectContaining({ event: 'PreToolUse', matcher: '.*', command }),
      expect.objectContaining({ event: 'PostToolUse', matcher: '.*', command }),
      expect.objectContaining({ event: 'PreCompact', command }),
      expect.objectContaining({ event: 'SessionStart', command }),
      expect.objectContaining({ event: 'UserPromptSubmit', command }),
      expect.objectContaining({ event: 'Stop', command })
    ]))
    expect((merged.hooks as unknown[]).filter(entry => (
      typeof (entry as { command?: unknown }).command === 'string' &&
      ((entry as { command: string }).command.includes('kimi-hook.js'))
    ))).toHaveLength(buildKimiNativeHookEntries(command).length)
  })

  it('merges managed Kimi hook entries into TOML config with a replaceable managed block', () => {
    const command = `"${process.execPath}" "/tmp/kimi-hook.js"`
    const first = mergeKimiNativeHooksIntoTomlConfig({
      content: 'default_model = "kimi-for-coding"\n',
      enabled: true,
      command
    })
    const second = mergeKimiNativeHooksIntoTomlConfig({
      content: first,
      enabled: true,
      command
    })

    expect(second).toContain('default_model = "kimi-for-coding"')
    expect(second.match(/\[\[hooks\]\]/gu)).toHaveLength(buildKimiNativeHookEntries(command).length)
    expect(second).toContain('event = "PreToolUse"')
    expect(second).toContain('event = "PreCompact"')
    expect(second).toContain('matcher = ".*"')
    expect(second).toContain(`command = ${JSON.stringify(command)}`)
  })

  it('writes native hooks into generated session config', async () => {
    const ctx = await createCtx()
    prepareKimiNativeHooks(ctx)

    const base = await resolveKimiSessionBase(ctx, {
      type: 'create',
      runtime: 'cli',
      sessionId: 'session-kimi-hooks',
      model: 'gateway,gpt-5',
      onEvent: () => {}
    })
    const configPathIndex = base.turnArgPrefix.indexOf('--config-file') + 1
    const configPath = base.turnArgPrefix[configPathIndex]
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      hooks?: Array<{ event: string; matcher?: string; command: string }>
    }

    expect(config.hooks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: 'PreToolUse',
        matcher: '.*',
        command: expect.stringContaining('kimi-hook.js')
      }),
      expect.objectContaining({
        event: 'PreCompact',
        command: expect.stringContaining('kimi-hook.js')
      })
    ]))
    expect(base.spawnEnv.__VF_KIMI_TASK_SESSION_ID__).toBe('session-kimi-hooks')
    expect(base.spawnEnv.__VF_KIMI_HOOK_RUNTIME__).toBe('cli')
    expect(base.spawnEnv.__VF_KIMI_HOOK_MODEL__).toBe('gateway,gpt-5')
  })

  it.skipIf(process.platform === 'win32')(
    'adapts Kimi hook stdin and blocks when Vibe hook output blocks',
    async () => {
      const workspace = await createTempDir('vf-kimi-hook-wrapper-')
      const fakeCallHookPath = join(workspace, 'fake-call-hook.js')
      const capturedInputPath = join(workspace, 'captured.json')
      await mkdir(workspace, { recursive: true })
      await writeFile(
        fakeCallHookPath,
        `const fs = require('node:fs')
const input = JSON.parse(fs.readFileSync(0, 'utf8'))
fs.writeFileSync(process.env.CAPTURED_INPUT, JSON.stringify(input, null, 2))
process.stdout.write(JSON.stringify({ continue: false, stopReason: 'blocked by test' }))
`
      )

      const result = spawnSync(
        process.execPath,
        [resolve(process.cwd(), 'packages/adapters/kimi/kimi-hook.js')],
        {
          input: JSON.stringify({
            session_id: 'kimi-native-session',
            cwd: workspace,
            hook_event_name: 'PreToolUse',
            tool_name: 'Shell',
            tool_input: { command: 'rm -rf /' },
            tool_call_id: 'tc_1'
          }),
          encoding: 'utf8',
          env: {
            ...process.env,
            __VF_KIMI_CALL_HOOK_PATH__: fakeCallHookPath,
            __VF_KIMI_TASK_SESSION_ID__: 'vf-session',
            __VF_KIMI_HOOK_RUNTIME__: 'cli',
            CAPTURED_INPUT: capturedInputPath
          }
        }
      )
      const captured = JSON.parse(await readFile(capturedInputPath, 'utf8')) as Record<string, unknown>

      expect(result.status).toBe(2)
      expect(result.stderr).toContain('blocked by test')
      expect(captured).toMatchObject({
        adapter: 'kimi',
        hookEventName: 'PreToolUse',
        hookSource: 'native',
        canBlock: true,
        sessionId: 'vf-session',
        toolName: 'Shell',
        toolCallId: 'tc_1',
        toolInput: { command: 'rm -rf /' }
      })
    }
  )

  it.skipIf(process.platform === 'win32')(
    'adapts Kimi PreCompact payloads into unified PreCompact hooks',
    async () => {
      const workspace = await createTempDir('vf-kimi-hook-precompact-')
      const fakeCallHookPath = join(workspace, 'fake-call-hook.js')
      const capturedInputPath = join(workspace, 'captured.json')
      await mkdir(workspace, { recursive: true })
      await writeFile(
        fakeCallHookPath,
        `const fs = require('node:fs')
const input = JSON.parse(fs.readFileSync(0, 'utf8'))
fs.writeFileSync(process.env.CAPTURED_INPUT, JSON.stringify(input, null, 2))
process.stdout.write(JSON.stringify({ continue: false, stopReason: 'compact blocked by test' }))
`
      )

      const result = spawnSync(
        process.execPath,
        [resolve(process.cwd(), 'packages/adapters/kimi/kimi-hook.js')],
        {
          input: JSON.stringify({
            session_id: 'kimi-native-session',
            cwd: workspace,
            hook_event_name: 'PreCompact',
            trigger: 'token_limit',
            token_count: 4096
          }),
          encoding: 'utf8',
          env: {
            ...process.env,
            __VF_KIMI_CALL_HOOK_PATH__: fakeCallHookPath,
            __VF_KIMI_TASK_SESSION_ID__: 'vf-session',
            __VF_KIMI_HOOK_RUNTIME__: 'cli',
            CAPTURED_INPUT: capturedInputPath
          }
        }
      )
      const captured = JSON.parse(await readFile(capturedInputPath, 'utf8')) as Record<string, unknown>

      expect(result.status).toBe(2)
      expect(result.stderr).toContain('compact blocked by test')
      expect(captured).toMatchObject({
        adapter: 'kimi',
        hookEventName: 'PreCompact',
        hookSource: 'native',
        canBlock: true,
        sessionId: 'vf-session',
        trigger: 'token_limit',
        tokenCount: 4096
      })
    }
  )

  it.skipIf(process.platform === 'win32')(
    'does not block non-blocking Kimi native hook events',
    async () => {
      const workspace = await createTempDir('vf-kimi-hook-wrapper-')
      const fakeCallHookPath = join(workspace, 'fake-call-hook.js')
      const capturedInputPath = join(workspace, 'captured.json')
      await mkdir(workspace, { recursive: true })
      await writeFile(
        fakeCallHookPath,
        `const fs = require('node:fs')
const input = JSON.parse(fs.readFileSync(0, 'utf8'))
fs.writeFileSync(process.env.CAPTURED_INPUT, JSON.stringify(input, null, 2))
process.stdout.write(JSON.stringify({ continue: false, stopReason: 'stop hook note' }))
`
      )

      const result = spawnSync(
        process.execPath,
        [resolve(process.cwd(), 'packages/adapters/kimi/kimi-hook.js')],
        {
          input: JSON.stringify({
            session_id: 'kimi-native-session',
            cwd: workspace,
            hook_event_name: 'Stop',
            stop_hook_active: true
          }),
          encoding: 'utf8',
          env: {
            ...process.env,
            __VF_KIMI_CALL_HOOK_PATH__: fakeCallHookPath,
            __VF_KIMI_TASK_SESSION_ID__: 'vf-session',
            __VF_KIMI_HOOK_RUNTIME__: 'cli',
            CAPTURED_INPUT: capturedInputPath
          }
        }
      )
      const captured = JSON.parse(await readFile(capturedInputPath, 'utf8')) as Record<string, unknown>

      expect(result.status).toBe(0)
      expect(result.stderr).toContain('stop hook note')
      expect(captured).toMatchObject({
        adapter: 'kimi',
        hookEventName: 'Stop',
        hookSource: 'native',
        canBlock: false,
        sessionId: 'vf-session',
        stopHookActive: true
      })
    }
  )
})
