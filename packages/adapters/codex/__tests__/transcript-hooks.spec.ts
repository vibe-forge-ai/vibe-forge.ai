import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { callHook } from '@vibe-forge/hooks'

import { createCodexTranscriptHookWatcher } from '#~/runtime/transcript-hooks.js'

vi.mock('@vibe-forge/hooks', () => ({
  callHook: vi.fn()
}))

const callHookMock = vi.mocked(callHook)

const waitFor = async (ms: number) => {
  await new Promise(resolve => setTimeout(resolve, ms))
}

const createLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
})

const createTimestamp = () => new Date().toISOString()

describe('createCodexTranscriptHookWatcher', () => {
  let homeDir: string
  let sessionsDir: string

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'codex-transcript-hooks-'))
    sessionsDir = join(homeDir, '.codex', 'sessions', '2026', '04', '06')
    await mkdir(sessionsDir, { recursive: true })
    callHookMock.mockReset()
    callHookMock.mockResolvedValue({ continue: true } as any)
  })

  afterEach(async () => {
    await waitFor(20)
  })

  it('bridges apply_patch transcript events into observational pre/post hooks', async () => {
    const logger = createLogger()
    const timestamp = createTimestamp()
    const watcher = createCodexTranscriptHookWatcher({
      cwd: '/tmp/project',
      env: {},
      homeDir,
      logger: logger as any,
      runtime: 'server',
      sessionId: 'vf-session',
      pollIntervalMs: 10
    })

    watcher.start()

    const transcriptPath = join(sessionsDir, 'rollout-2026-04-06T00-00-00-abc.jsonl')
    await writeFile(
      transcriptPath,
      [
        JSON.stringify({
          timestamp,
          type: 'session_meta',
          payload: {
            id: 'codex-session',
            timestamp,
            cwd: '/tmp/project'
          }
        }),
        JSON.stringify({
          timestamp,
          type: 'response_item',
          payload: {
            type: 'custom_tool_call',
            status: 'completed',
            call_id: 'call_apply_patch',
            name: 'apply_patch',
            input: '*** Begin Patch\n*** Add File: /tmp/project/example.txt\n+hello\n*** End Patch\n'
          }
        }),
        JSON.stringify({
          timestamp,
          type: 'response_item',
          payload: {
            type: 'custom_tool_call_output',
            call_id: 'call_apply_patch',
            output: JSON.stringify({
              output: 'Success. Updated the following files:\nA /tmp/project/example.txt\n',
              metadata: { exit_code: 0 }
            })
          }
        }),
        ''
      ].join('\n')
    )

    await waitFor(80)
    watcher.stop()

    expect(callHookMock).toHaveBeenNthCalledWith(
      1,
      'PreToolUse',
      expect.objectContaining({
        adapter: 'codex',
        canBlock: false,
        cwd: '/tmp/project',
        hookSource: 'bridge',
        runtime: 'server',
        sessionId: 'vf-session',
        toolCallId: 'call_apply_patch',
        toolName: 'adapter:codex:ApplyPatch',
        toolInput: {
          patch: '*** Begin Patch\n*** Add File: /tmp/project/example.txt\n+hello\n*** End Patch\n'
        },
        transcriptPath
      }),
      {}
    )
    expect(callHookMock).toHaveBeenNthCalledWith(
      2,
      'PostToolUse',
      expect.objectContaining({
        adapter: 'codex',
        canBlock: false,
        cwd: '/tmp/project',
        hookSource: 'bridge',
        runtime: 'server',
        sessionId: 'vf-session',
        toolCallId: 'call_apply_patch',
        toolName: 'adapter:codex:ApplyPatch',
        toolInput: {
          patch: '*** Begin Patch\n*** Add File: /tmp/project/example.txt\n+hello\n*** End Patch\n'
        },
        transcriptPath,
        isError: false,
        toolResponse: {
          output: 'Success. Updated the following files:\nA /tmp/project/example.txt\n',
          metadata: { exit_code: 0 }
        }
      }),
      {}
    )
  })

  it('skips bash-like transcript tool calls to avoid duplicating native bash hooks', async () => {
    const timestamp = createTimestamp()
    const watcher = createCodexTranscriptHookWatcher({
      cwd: '/tmp/project',
      env: {},
      homeDir,
      logger: createLogger() as any,
      runtime: 'server',
      sessionId: 'vf-session',
      pollIntervalMs: 10
    })

    watcher.start()

    await writeFile(
      join(sessionsDir, 'rollout-2026-04-06T00-00-00-bash.jsonl'),
      [
        JSON.stringify({
          timestamp,
          type: 'session_meta',
          payload: {
            id: 'codex-session',
            timestamp,
            cwd: '/tmp/project'
          }
        }),
        JSON.stringify({
          timestamp,
          type: 'response_item',
          payload: {
            type: 'function_call',
            call_id: 'call_exec',
            name: 'exec_command',
            arguments: JSON.stringify({ cmd: 'pwd' })
          }
        }),
        ''
      ].join('\n')
    )

    await waitFor(60)
    watcher.stop()

    expect(callHookMock).not.toHaveBeenCalled()
  })

  it('emits observational pre/post hooks for web_search transcript entries', async () => {
    const timestamp = createTimestamp()
    const watcher = createCodexTranscriptHookWatcher({
      cwd: '/tmp/project',
      env: {},
      homeDir,
      logger: createLogger() as any,
      runtime: 'server',
      sessionId: 'vf-session',
      pollIntervalMs: 10
    })

    watcher.start()

    const transcriptPath = join(sessionsDir, 'rollout-2026-04-06T00-00-00-web.jsonl')
    await writeFile(
      transcriptPath,
      [
        JSON.stringify({
          timestamp,
          type: 'session_meta',
          payload: {
            id: 'codex-session',
            timestamp,
            cwd: '/tmp/project'
          }
        }),
        JSON.stringify({
          timestamp,
          type: 'response_item',
          payload: {
            type: 'web_search_call',
            status: 'completed',
            action: {
              type: 'search',
              query: 'codex transcript hooks'
            }
          }
        }),
        ''
      ].join('\n')
    )

    await waitFor(60)
    watcher.stop()

    expect(callHookMock).toHaveBeenNthCalledWith(
      1,
      'PreToolUse',
      expect.objectContaining({
        toolName: 'adapter:codex:WebSearch',
        toolInput: { query: 'codex transcript hooks' },
        transcriptPath
      }),
      {}
    )
    expect(callHookMock).toHaveBeenNthCalledWith(
      2,
      'PostToolUse',
      expect.objectContaining({
        toolName: 'adapter:codex:WebSearch',
        toolInput: { query: 'codex transcript hooks' },
        toolResponse: {
          status: 'completed',
          action: {
            type: 'search',
            query: 'codex transcript hooks'
          }
        },
        transcriptPath
      }),
      {}
    )
  })

  it('ignores transcript files from other working directories', async () => {
    const timestamp = createTimestamp()
    const watcher = createCodexTranscriptHookWatcher({
      cwd: '/tmp/project',
      env: {},
      homeDir,
      logger: createLogger() as any,
      runtime: 'server',
      sessionId: 'vf-session',
      pollIntervalMs: 10
    })

    watcher.start()

    await writeFile(
      join(sessionsDir, 'rollout-2026-04-06T00-00-00-foreign.jsonl'),
      [
        JSON.stringify({
          timestamp,
          type: 'session_meta',
          payload: {
            id: 'codex-session',
            timestamp,
            cwd: '/tmp/other-project'
          }
        }),
        JSON.stringify({
          timestamp,
          type: 'response_item',
          payload: {
            type: 'custom_tool_call',
            status: 'completed',
            call_id: 'call_apply_patch',
            name: 'apply_patch',
            input: '*** Begin Patch\n*** End Patch\n'
          }
        }),
        ''
      ].join('\n')
    )

    await waitFor(60)
    watcher.stop()

    expect(callHookMock).not.toHaveBeenCalled()
  })
})
