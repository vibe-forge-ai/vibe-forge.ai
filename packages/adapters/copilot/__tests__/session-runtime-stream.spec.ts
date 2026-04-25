import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { AdapterOutputEvent } from '@vibe-forge/types'

import { createCopilotSession } from '#~/runtime/session.js'

import {
  flushAsyncWork,
  makeCtx,
  makeErrorProc,
  makeProc,
  makeTempDir,
  registerRuntimeTestHooks
} from './runtime-test-helpers'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
  spawn: vi.fn()
}))

const spawnMock = vi.mocked(spawn)

describe('createCopilotSession stream runtime', () => {
  registerRuntimeTestHooks()

  it('runs copilot prompt mode with JSON output and emits message/stop', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stdout: [
          JSON.stringify({
            type: 'assistant.message_delta',
            data: { messageId: 'msg_1', deltaContent: 'pong' }
          }),
          JSON.stringify({
            type: 'assistant.message',
            data: { messageId: 'msg_1', content: 'pong' }
          }),
          JSON.stringify({
            type: 'result',
            sessionId: 'session-1',
            exitCode: 0
          })
        ].join('\n')
      })
    )

    const events: AdapterOutputEvent[] = []
    const { ctx, cacheStore } = makeCtx()

    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-1',
      description: 'Reply with exactly pong.',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(spawnMock.mock.calls[0]?.[0]).toBe('/bin/copilot')
    expect(spawnMock.mock.calls[0]?.[1]).toEqual([
      '--resume',
      'session-1',
      '--no-auto-update',
      '--no-remote',
      '--config-dir',
      `${ctx.cwd}/.ai/.mock/copilot`,
      '--prompt',
      'Reply with exactly pong.',
      '--output-format',
      'json',
      '--stream',
      'on'
    ])
    expect(events.map(event => event.type)).toEqual(['init', 'message', 'stop'])
    expect(events[1]).toMatchObject({ type: 'message', data: { role: 'assistant', content: 'pong' } })
    expect(cacheStore.get('adapter.copilot.session')).toMatchObject({
      copilotSessionId: 'session-1',
      title: 'Vibe Forge:session-1'
    })
  })

  it('does not start a turn until a message arrives when create has no description', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stdout: JSON.stringify({
          type: 'assistant.message',
          data: { messageId: 'msg_later', content: 'later' }
        })
      })
    )

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()
    const session = await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-empty-create',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()
    expect(spawnMock).not.toHaveBeenCalled()
    expect(events).toEqual([expect.objectContaining({ type: 'init' })])

    session.emit({ type: 'message', content: [{ type: 'text', text: 'later' }] })

    await flushAsyncWork()
    expect(spawnMock).toHaveBeenCalledTimes(1)
    expect(spawnMock.mock.calls[0]?.[1]).toContain('later')
    expect(events.some(event => event.type === 'stop')).toBe(true)
  })

  it('maps bypass permission mode to Copilot allow-all', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stdout: JSON.stringify({
          type: 'assistant.message',
          data: { messageId: 'msg_allow', content: 'done' }
        })
      })
    )

    const { ctx } = makeCtx()
    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-allow',
      description: 'do it',
      permissionMode: 'bypassPermissions',
      onEvent: () => {}
    } as any)

    await flushAsyncWork()
    expect(spawnMock.mock.calls[0]?.[1]).toContain('--allow-all')
  })

  it('maps stable Copilot CLI options into args, env, and managed settings', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stdout: JSON.stringify({
          type: 'assistant.message',
          data: { messageId: 'msg_options', content: 'done' }
        })
      })
    )

    const cwd = await makeTempDir()
    const { ctx } = makeCtx({
      cwd,
      env: {
        __VF_PROJECT_AI_ADAPTER_COPILOT_CLI_PATH__: '/bin/copilot',
        COPILOT_AGENT_DIRS: '/existing/agents'
      },
      configs: [{
        adapters: {
          copilot: {
            remote: true,
            agent: 'reviewer',
            agentDirs: ['/tmp/agents-a', '/tmp/agents-b'],
            pluginDirs: ['/tmp/plugin-a', '/tmp/plugin-b'],
            additionalInstructions: 'Prefer small patches.',
            allowTools: ['shell(git:*)'],
            denyTools: ['shell(git push)'],
            allowUrls: ['https://docs.github.com/copilot/*'],
            denyUrls: ['https://example.invalid'],
            additionalDirs: ['/tmp/shared'],
            mode: 'autopilot',
            autopilot: true,
            maxAutopilotContinues: 2,
            noColor: true,
            noBanner: true,
            debug: true,
            experimental: true,
            enableReasoningSummaries: true,
            configContent: {
              askUser: false,
              nested: {
                project: true
              }
            }
          }
        }
      }, {
        adapters: {
          copilot: {
            configContent: {
              nested: {
                user: true
              }
            }
          }
        }
      }]
    })

    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-options',
      description: 'hello',
      onEvent: () => {}
    } as any)

    await flushAsyncWork()

    const args = spawnMock.mock.calls[0]?.[1] as string[]
    const spawnOptions = spawnMock.mock.calls[0]?.[2] as { env?: Record<string, string> }
    expect(args).toEqual(expect.arrayContaining([
      '--remote',
      '--agent',
      'reviewer',
      '--plugin-dir',
      '/tmp/plugin-a',
      '--plugin-dir',
      '/tmp/plugin-b',
      '--allow-tool',
      'shell(git:*)',
      '--deny-tool',
      'shell(git push)',
      '--allow-url',
      'https://docs.github.com/copilot/*',
      '--deny-url',
      'https://example.invalid',
      '--add-dir',
      '/tmp/shared',
      '--mode',
      'autopilot',
      '--max-autopilot-continues',
      '2',
      '--no-color',
      '--no-banner',
      '--debug',
      '--experimental',
      '--enable-reasoning-summaries'
    ]))
    expect(args).not.toContain('--no-remote')
    expect(args).not.toContain('--autopilot')
    expect(spawnOptions.env?.COPILOT_AGENT_DIRS).toBe('/existing/agents,/tmp/agents-a,/tmp/agents-b')
    expect(spawnOptions.env?.COPILOT_ADDITIONAL_CUSTOM_INSTRUCTIONS).toBe('Prefer small patches.')
    expect(JSON.parse(await readFile(`${cwd}/.ai/.mock/copilot/settings.json`, 'utf8'))).toEqual({
      askUser: false,
      nested: {
        project: true,
        user: true
      },
      trusted_folders: [cwd]
    })
  })

  it('stages system prompt and selected skills for Copilot native discovery', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stdout: JSON.stringify({
          type: 'assistant.message',
          data: { messageId: 'msg_assets', content: 'done' }
        })
      })
    )

    const cwd = await makeTempDir()
    const skillDir = join(cwd, '.ai/skills/research')
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, 'SKILL.md'), '---\ndescription: research\n---\nUse docs.\n', 'utf8')

    const { ctx } = makeCtx({ cwd })
    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-assets',
      description: 'hello',
      systemPrompt: 'Use the Vibe Forge workspace context.',
      assetPlan: {
        adapter: 'copilot',
        diagnostics: [],
        mcpServers: {},
        overlays: [{
          assetId: 'skill:research',
          kind: 'skill',
          sourcePath: skillDir,
          targetPath: 'skills/research'
        }]
      },
      onEvent: () => {}
    } as any)

    await flushAsyncWork()

    const spawnOptions = spawnMock.mock.calls[0]?.[2] as { env?: Record<string, string> } | undefined
    const env = spawnOptions?.env
    expect(env?.COPILOT_HOME).toBe(`${cwd}/.ai/.mock/copilot`)
    expect(env?.COPILOT_SKILLS_DIRS).toBe(`${cwd}/.ai/.mock/copilot/sessions/session-assets/skills`)
    expect(env?.COPILOT_CUSTOM_INSTRUCTIONS_DIRS).toBe(
      `${cwd}/.ai/.mock/copilot/sessions/session-assets/instructions`
    )
    expect(
      await readFile(
        `${cwd}/.ai/.mock/copilot/sessions/session-assets/instructions/copilot-instructions.md`,
        'utf8'
      )
    ).toBe('Use the Vibe Forge workspace context.\n')
  })

  it('maps routed model services to Copilot provider env and resolved model flag', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stdout: JSON.stringify({
          type: 'assistant.message',
          data: { messageId: 'msg_provider', content: 'done' }
        })
      })
    )

    const { ctx } = makeCtx({
      configs: [{
        modelServices: {
          local: {
            apiBaseUrl: 'http://127.0.0.1:11434/v1',
            apiKey: 'local-key',
            maxOutputTokens: 8192,
            extra: {
              copilot: {
                type: 'openai',
                wireApi: 'responses',
                offline: true
              }
            }
          }
        }
      }, undefined]
    })
    const events: AdapterOutputEvent[] = []

    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-provider',
      description: 'hello',
      model: 'local,gpt-5',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    const args = spawnMock.mock.calls[0]?.[1] as string[]
    const spawnOptions = spawnMock.mock.calls[0]?.[2] as { env?: Record<string, string> } | undefined
    expect(args).toEqual(expect.arrayContaining(['--model', 'gpt-5']))
    expect(events[0]).toMatchObject({ type: 'init', data: { model: 'gpt-5' } })
    expect(spawnOptions?.env).toMatchObject({
      COPILOT_PROVIDER_API_KEY: 'local-key',
      COPILOT_PROVIDER_TYPE: 'openai',
      COPILOT_PROVIDER_MODEL_ID: 'gpt-5',
      COPILOT_PROVIDER_WIRE_MODEL: 'gpt-5',
      COPILOT_PROVIDER_WIRE_API: 'responses',
      COPILOT_PROVIDER_MAX_OUTPUT_TOKENS: '8192',
      COPILOT_OFFLINE: 'true'
    })
    expect(spawnOptions?.env?.COPILOT_PROVIDER_BASE_URL).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/__vf_provider\/route-\d+$/
    )
  })

  it('emits an error and exit when prompt mode fails', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stderr: 'auth failed\n',
        exitCode: 1
      })
    )

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()

    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-error',
      description: 'hello',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(events).toEqual([
      expect.objectContaining({ type: 'init' }),
      expect.objectContaining({
        type: 'error',
        data: expect.objectContaining({
          message: 'auth failed',
          fatal: true
        })
      }),
      { type: 'exit', data: { exitCode: 1, stderr: 'auth failed' } }
    ])
  })

  it('emits exit when stop() is called after a successful stream turn', async () => {
    spawnMock.mockImplementation(() =>
      makeProc({
        stdout: JSON.stringify({
          type: 'assistant.message',
          data: { messageId: 'msg_stop', content: 'done' }
        })
      })
    )

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()
    const session = await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-stop',
      description: 'hello',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()
    session.stop?.()

    expect(events.map(event => event.type)).toEqual(['init', 'message', 'stop', 'exit'])
    expect(events.at(-1)).toEqual({ type: 'exit', data: { exitCode: 0 } })
  })

  it('emits exit when the copilot process cannot start', async () => {
    spawnMock.mockImplementation(() => makeErrorProc(new Error('spawn failed')))

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()

    await createCopilotSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-spawn-error',
      description: 'hello',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(events).toEqual([
      expect.objectContaining({ type: 'init' }),
      expect.objectContaining({
        type: 'error',
        data: expect.objectContaining({
          message: 'spawn failed',
          fatal: true
        })
      }),
      { type: 'exit', data: { exitCode: 1, stderr: 'spawn failed' } }
    ])
  })
})
