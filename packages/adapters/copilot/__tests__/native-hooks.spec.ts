import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { prepareCopilotNativeHooks } from '../src/runtime/native-hooks'
import { ensureCopilotConfigDir, ensureCopilotRuntimeSettings } from '../src/runtime/shared'

const tempDirs: string[] = []

const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vf-copilot-hooks-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('copilot native hooks', () => {
  it('prepares the shared hook runtime and marks Copilot native hooks available', () => {
    const ctx = {
      cwd: '/tmp/project',
      env: {},
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      assets: {
        hookPlugins: [{ id: 'hookPlugin:project:logger' }]
      }
    } as any

    expect(prepareCopilotNativeHooks(ctx)).toBe(true)
    expect(ctx.env.__VF_PROJECT_AI_COPILOT_NATIVE_HOOKS_AVAILABLE__).toBe('1')
    expect(ctx.env.__VF_PROJECT_AI_COPILOT_HOOK_COMMAND__).toContain('call-hook.js')
    expect(ctx.env.__VF_PROJECT_NODE_PATH__).toBe(process.execPath)
    expect(ctx.env.__VF_PROJECT_WORKSPACE_FOLDER__).toBe(ctx.cwd)
  })

  it('writes managed hooks into Copilot settings without duplicating existing hook entries', async () => {
    const cwd = await createWorkspace()
    const ctx = {
      cwd,
      env: {
        __VF_PROJECT_AI_COPILOT_NATIVE_HOOKS_AVAILABLE__: '1',
        __VF_PROJECT_AI_COPILOT_HOOK_COMMAND__: `"${process.execPath}" "/tmp/call-hook.js"`
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    } as any
    const configDir = await ensureCopilotConfigDir(ctx, {})

    await ensureCopilotRuntimeSettings(
      ctx,
      {
        type: 'create',
        runtime: 'server',
        sessionId: 'session-hooks',
        model: 'gpt-5',
        onEvent: () => {}
      } as any,
      {},
      configDir
    )
    await ensureCopilotRuntimeSettings(
      ctx,
      {
        type: 'create',
        runtime: 'server',
        sessionId: 'session-hooks',
        model: 'gpt-5',
        onEvent: () => {}
      } as any,
      {},
      configDir
    )

    const settings = JSON.parse(await readFile(join(configDir, 'settings.json'), 'utf8')) as {
      hooks?: Record<string, unknown[]>
    }

    expect(settings.hooks?.PreToolUse).toHaveLength(1)
    expect(settings.hooks?.PostToolUse).toHaveLength(1)
    expect(settings.hooks?.Stop).toHaveLength(1)
    expect(settings.hooks?.PreToolUse?.[0]).not.toHaveProperty('matcher')
    expect(settings.hooks?.PostToolUse?.[0]).not.toHaveProperty('matcher')
    expect(JSON.stringify(settings)).toContain('__VF_VIBE_FORGE_COPILOT_HOOKS_ACTIVE')
    expect(JSON.stringify(settings)).toContain('__VF_COPILOT_TASK_SESSION_ID')
    expect(JSON.stringify(settings)).toContain('call-hook.js')
  })

  it('does not write empty native hook arrays when the managed bridge is disabled', async () => {
    const cwd = await createWorkspace()
    const ctx = {
      cwd,
      env: {
        __VF_PROJECT_AI_COPILOT_NATIVE_HOOKS_AVAILABLE__: '0'
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    } as any
    const configDir = await ensureCopilotConfigDir(ctx, {})
    await writeFile(
      join(configDir, 'settings.json'),
      JSON.stringify({
        hooks: {
          UserPromptSubmit: [{
            type: 'command',
            bash: 'echo user-prompt'
          }]
        }
      }),
      'utf8'
    )

    await ensureCopilotRuntimeSettings(
      ctx,
      {
        type: 'create',
        runtime: 'server',
        sessionId: 'session-hooks-disabled',
        onEvent: () => {}
      } as any,
      {},
      configDir
    )

    const settings = JSON.parse(await readFile(join(configDir, 'settings.json'), 'utf8')) as {
      hooks?: Record<string, unknown[]>
    }

    expect(settings.hooks?.UserPromptSubmit).toHaveLength(1)
    expect(settings.hooks).not.toHaveProperty('PreToolUse')
    expect(settings.hooks).not.toHaveProperty('PostToolUse')
    expect(settings.hooks).not.toHaveProperty('Stop')
  })
})
