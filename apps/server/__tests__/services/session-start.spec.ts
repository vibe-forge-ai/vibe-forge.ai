import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '#~/db/index.js'
import { processUserMessage, resetSessionServiceState, startAdapterSession } from '#~/services/session/index.js'
import { adapterSessionStore, externalSessionStore, notifySessionUpdated } from '#~/services/session/runtime.js'

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  generateAdapterQueryOptions: vi.fn(),
  loadConfigState: vi.fn(),
  updateConfigFile: vi.fn(),
  handleChannelSessionEvent: vi.fn(),
  resolveChannelSessionMcpServers: vi.fn(),
  requestInteraction: vi.fn(),
  canRequestInteraction: vi.fn(),
  resolveSessionWorkspaceFolder: vi.fn(),
  provisionSessionWorkspace: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

vi.mock('@vibe-forge/app-runtime', () => ({
  generateAdapterQueryOptions: mocks.generateAdapterQueryOptions,
  run: mocks.run
}))

vi.mock('#~/channels/index.js', () => ({
  handleChannelSessionEvent: mocks.handleChannelSessionEvent,
  resolveChannelSessionMcpServers: mocks.resolveChannelSessionMcpServers
}))

vi.mock('#~/services/config/index.js', () => ({
  loadConfigState: mocks.loadConfigState,
  getWorkspaceFolder: vi.fn(() => process.cwd())
}))

vi.mock('@vibe-forge/config', () => ({
  updateConfigFile: mocks.updateConfigFile
}))

vi.mock('#~/services/session/interaction.js', () => ({
  requestInteraction: mocks.requestInteraction,
  canRequestInteraction: mocks.canRequestInteraction
}))

vi.mock('#~/services/session/workspace.js', () => ({
  resolveSessionWorkspaceFolder: mocks.resolveSessionWorkspaceFolder,
  provisionSessionWorkspace: mocks.provisionSessionWorkspace
}))

vi.mock('#~/services/session/notification.js', () => ({
  maybeNotifySession: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile
}))

vi.mock('#~/services/session/runtime.js', async () => {
  const actual = await vi.importActual<typeof import('#~/services/session/runtime.js')>(
    '#~/services/session/runtime.js'
  )
  return {
    ...actual,
    notifySessionUpdated: vi.fn()
  }
})

vi.mock('#~/utils/logger.js', () => ({
  getSessionLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

describe('startAdapterSession', () => {
  let currentSession: any
  const getMessages = vi.fn()
  const saveMessage = vi.fn()
  const createSession = vi.fn()
  const updateSession = vi.fn()
  const getSessionRuntimeState = vi.fn()
  const updateSessionRuntimeState = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    resetSessionServiceState()
    adapterSessionStore.clear()
    externalSessionStore.clear()

    currentSession = {
      id: 'sess-1',
      createdAt: Date.now(),
      status: 'completed',
      model: 'gpt-4o',
      adapter: 'codex',
      effort: 'medium',
      permissionMode: 'default'
    }

    getMessages.mockReturnValue([])
    createSession.mockImplementation((_title?: string, id?: string) => ({
      id: id ?? 'sess-1',
      createdAt: Date.now()
    }))
    updateSession.mockImplementation((_id: string, updates: Record<string, unknown>) => {
      currentSession = { ...currentSession, ...updates }
    })
    getSessionRuntimeState.mockReturnValue({
      runtimeKind: 'interactive',
      historySeedPending: false
    })

    vi.mocked(getDb).mockReturnValue({
      getMessages,
      saveMessage,
      getSession: vi.fn(() => currentSession),
      getSessionRuntimeState,
      createSession,
      updateSession,
      updateSessionRuntimeState
    } as any)

    mocks.generateAdapterQueryOptions.mockResolvedValue([
      {},
      {
        systemPrompt: undefined,
        tools: undefined,
        mcpServers: undefined
      }
    ])
    mocks.loadConfigState.mockResolvedValue({
      workspaceFolder: process.cwd(),
      projectConfig: {},
      mergedConfig: {}
    })
    mocks.updateConfigFile.mockResolvedValue({ ok: true })
    mocks.handleChannelSessionEvent.mockResolvedValue(undefined)
    mocks.resolveChannelSessionMcpServers.mockResolvedValue({})
    mocks.requestInteraction.mockReset()
    mocks.canRequestInteraction.mockReturnValue(false)
    mocks.resolveSessionWorkspaceFolder.mockResolvedValue(process.cwd())
    mocks.provisionSessionWorkspace.mockResolvedValue(undefined)
    mocks.mkdir.mockResolvedValue(undefined)
    mocks.writeFile.mockResolvedValue(undefined)
  })

  it('reuses the cached runtime when adapter config is unchanged', async () => {
    const runtime = {
      session: {
        emit: vi.fn(),
        kill: vi.fn()
      } as any,
      sockets: new Set(),
      messages: [],
      config: {
        runId: 'run-same',
        model: 'gpt-4o',
        adapter: 'codex',
        effort: 'medium',
        permissionMode: 'default'
      }
    }
    adapterSessionStore.set('sess-1', runtime as any)

    const result = await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      effort: 'medium',
      permissionMode: 'default'
    })

    expect(result).toBe(runtime)
    expect(mocks.run).not.toHaveBeenCalled()
    expect(runtime.session.kill).not.toHaveBeenCalled()
  })

  it('deduplicates concurrent start requests for the same session', async () => {
    let resolveRun:
      | ((value: { session: { emit: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn> } }) => void)
      | undefined
    const emit = vi.fn()
    const kill = vi.fn()

    mocks.run.mockImplementationOnce(async () => {
      return new Promise((resolve) => {
        resolveRun = resolve as typeof resolveRun
      })
    })

    const first = startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'claude-code',
      permissionMode: 'default'
    })
    const second = startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'claude-code',
      permissionMode: 'default'
    })

    await vi.waitFor(() => {
      expect(mocks.run).toHaveBeenCalledTimes(1)
      expect(resolveRun).toBeTypeOf('function')
    })

    resolveRun?.({
      session: {
        emit,
        kill
      }
    })

    const [firstRuntime, secondRuntime] = await Promise.all([first, second])
    expect(firstRuntime).toBe(secondRuntime)
    expect(mocks.run).toHaveBeenCalledTimes(1)
  })

  it('does not fail adapter startup when permission mirror sync fails', async () => {
    const emit = vi.fn()
    const kill = vi.fn()
    mocks.writeFile.mockRejectedValueOnce(new Error('readonly filesystem'))
    mocks.run.mockResolvedValueOnce({
      session: {
        emit,
        kill
      }
    })

    const runtime = await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'claude-code',
      permissionMode: 'default'
    })

    expect(runtime.session.emit).toBe(emit)
    expect(runtime.config?.adapter).toBe('claude-code')
    expect(mocks.run).toHaveBeenCalledTimes(1)
  })

  it('resolves the adapter cwd from the session workspace service', async () => {
    const emit = vi.fn()
    const kill = vi.fn()
    mocks.resolveSessionWorkspaceFolder.mockResolvedValueOnce('/workspace/.ai/worktrees/sessions/sess-1')
    mocks.run.mockResolvedValueOnce({
      session: {
        emit,
        kill
      }
    })

    await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default'
    })

    expect(mocks.generateAdapterQueryOptions).toHaveBeenCalledWith(
      undefined,
      undefined,
      '/workspace/.ai/worktrees/sessions/sess-1',
      expect.objectContaining({
        adapter: 'codex',
        model: 'gpt-4o'
      })
    )
    expect(mocks.run).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/workspace/.ai/worktrees/sessions/sess-1',
        adapter: 'codex'
      }),
      expect.any(Object)
    )
  })

  it('passes channel companion MCP servers into the runtime query options', async () => {
    const emit = vi.fn()
    const kill = vi.fn()
    mocks.resolveChannelSessionMcpServers.mockResolvedValueOnce({
      'channel-lark-default': {
        command: process.execPath,
        args: ['/tmp/channel-lark-mcp.js'],
        env: {
          VF_LARK_APP_ID: 'cli_app'
        }
      }
    })
    mocks.run.mockResolvedValueOnce({
      session: {
        emit,
        kill
      }
    })

    await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default'
    })

    expect(mocks.run).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runtimeMcpServers: {
          'channel-lark-default': {
            command: process.execPath,
            args: ['/tmp/channel-lark-mcp.js'],
            env: {
              VF_LARK_APP_ID: 'cli_app'
            }
          }
        }
      })
    )
  })

  it('restarts the runtime when adapter changes and ignores stale exit events', async () => {
    const oldKill = vi.fn()
    const oldEmit = vi.fn()
    const newKill = vi.fn()
    const newEmit = vi.fn()
    let oldOnEvent: ((event: any) => void) | undefined

    getMessages.mockReturnValue([
      {
        type: 'message',
        message: {
          id: 'assist-1',
          role: 'assistant',
          content: 'previous answer',
          createdAt: Date.now()
        }
      }
    ])

    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      expect(adapterOptions.type).toBe('resume')
      oldOnEvent = adapterOptions.onEvent
      return {
        session: {
          kill: oldKill,
          emit: oldEmit
        }
      }
    })

    const initialRuntime = await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default'
    })

    expect(initialRuntime.config?.adapter).toBe('codex')

    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      expect(adapterOptions.type).toBe('create')
      return {
        session: {
          kill: newKill,
          emit: newEmit
        }
      }
    })

    const restartedRuntime = await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'claude-code',
      permissionMode: 'default'
    })

    expect(oldKill).toHaveBeenCalledOnce()
    expect(restartedRuntime).not.toBe(initialRuntime)
    expect(restartedRuntime.config?.adapter).toBe('claude-code')
    expect(currentSession.adapter).toBe('claude-code')

    oldOnEvent?.({
      type: 'exit',
      data: {
        exitCode: 1,
        stderr: 'old runtime exit'
      }
    })

    expect(currentSession.status).toBe('completed')
    expect(adapterSessionStore.get('sess-1')).toBe(restartedRuntime)
    expect(vi.mocked(notifySessionUpdated)).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        adapter: 'claude-code'
      })
    )
    expect(newKill).not.toHaveBeenCalled()
  })

  it('restarts the runtime when effort changes', async () => {
    const oldKill = vi.fn()
    const oldEmit = vi.fn()
    const newKill = vi.fn()
    const newEmit = vi.fn()

    mocks.run.mockImplementationOnce(async () => {
      return {
        session: {
          kill: oldKill,
          emit: oldEmit
        }
      }
    })

    const initialRuntime = await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      effort: 'medium',
      permissionMode: 'default'
    })

    mocks.run.mockImplementationOnce(async () => {
      return {
        session: {
          kill: newKill,
          emit: newEmit
        }
      }
    })

    const restartedRuntime = await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      effort: 'high',
      permissionMode: 'default'
    })

    expect(oldKill).toHaveBeenCalledOnce()
    expect(restartedRuntime).not.toBe(initialRuntime)
    expect(restartedRuntime.config?.effort).toBe('high')
    expect(currentSession.effort).toBe('high')
  })

  it('restarts the runtime when the persisted session is updated but the cached permission mode is still stale', async () => {
    const oldKill = vi.fn()
    const oldEmit = vi.fn()
    const newKill = vi.fn()
    const newEmit = vi.fn()

    currentSession = {
      ...currentSession,
      permissionMode: undefined
    }

    mocks.run.mockImplementationOnce(async () => {
      return {
        session: {
          kill: oldKill,
          emit: oldEmit
        }
      }
    })

    const initialRuntime = await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'claude-code',
      permissionMode: undefined
    })

    expect(initialRuntime.config?.permissionMode).toBeUndefined()

    currentSession = {
      ...currentSession,
      permissionMode: 'bypassPermissions'
    }

    mocks.run.mockImplementationOnce(async () => {
      return {
        session: {
          kill: newKill,
          emit: newEmit
        }
      }
    })

    const restartedRuntime = await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'claude-code',
      permissionMode: 'bypassPermissions'
    })

    expect(oldKill).toHaveBeenCalledOnce()
    expect(restartedRuntime).not.toBe(initialRuntime)
    expect(restartedRuntime.config?.permissionMode).toBe('bypassPermissions')
  })

  it('marks the session as failed when adapter startup throws', async () => {
    mocks.run.mockRejectedValueOnce(new Error('adapter init failed'))

    await expect(startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default'
    })).rejects.toThrow('adapter init failed')

    expect(currentSession.status).toBe('failed')
    expect(vi.mocked(notifySessionUpdated)).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        status: 'failed'
      })
    )
  })

  it('replaces the generated system prompt when appendSystemPrompt is false', async () => {
    mocks.generateAdapterQueryOptions.mockResolvedValueOnce([
      {},
      {
        systemPrompt: 'generated prompt',
        tools: undefined,
        mcpServers: undefined
      }
    ])
    mocks.run.mockResolvedValueOnce({
      session: {
        emit: vi.fn(),
        kill: vi.fn()
      }
    })

    await startAdapterSession('sess-1', {
      systemPrompt: 'custom prompt',
      appendSystemPrompt: false
    })

    expect(mocks.run).toHaveBeenCalledOnce()
    expect(mocks.run.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      systemPrompt: 'custom prompt',
      appendSystemPrompt: false
    }))
  })

  it('injects pending history seed only for the first restart of a branched session', async () => {
    getSessionRuntimeState.mockReturnValue({
      runtimeKind: 'interactive',
      historySeed: '历史上下文',
      historySeedPending: true
    })
    mocks.generateAdapterQueryOptions.mockResolvedValueOnce([
      {},
      {
        systemPrompt: 'generated prompt',
        tools: undefined,
        mcpServers: undefined
      }
    ])
    mocks.run.mockResolvedValueOnce({
      session: {
        emit: vi.fn(),
        kill: vi.fn()
      }
    })

    const runtime = await startAdapterSession('sess-1', {
      adapter: 'codex'
    })

    expect(mocks.run.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      type: 'create'
    }))
    expect(mocks.run.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      systemPrompt: 'generated prompt\n\n历史上下文'
    }))
    expect(updateSessionRuntimeState).toHaveBeenCalledWith('sess-1', { historySeedPending: false })
    expect(runtime.config?.seededFromHistory).toBe(true)
  })

  it('keeps the session failed when a fatal error is followed by stop', async () => {
    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      adapterOptions.onEvent({
        type: 'error',
        data: {
          message: 'turn failed',
          fatal: true
        }
      })
      adapterOptions.onEvent({
        type: 'stop',
        data: undefined
      })
      return {
        session: {
          emit: vi.fn(),
          kill: vi.fn()
        }
      }
    })

    await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default'
    })

    expect(currentSession.status).toBe('failed')
  })

  it('preserves the full model selector after adapter init reports a bare model id', async () => {
    let onEvent: ((event: any) => void) | undefined

    mocks.run
      .mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
        onEvent = adapterOptions.onEvent
        return {
          session: {
            emit: vi.fn(),
            kill: vi.fn()
          }
        }
      })
      .mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
        expect(adapterOptions.type).toBe('resume')
        expect(adapterOptions.model).toBe('gpt-responses,gpt-5.4-2026-03-05')
        return {
          session: {
            emit: vi.fn(),
            kill: vi.fn()
          }
        }
      })

    await startAdapterSession('sess-1', {
      model: 'gpt-responses,gpt-5.4-2026-03-05',
      adapter: 'codex',
      permissionMode: 'default'
    })

    onEvent?.({
      type: 'init',
      data: {
        uuid: 'sess-1',
        model: 'gpt-5.4-2026-03-05',
        adapter: 'codex',
        version: 'unknown',
        tools: [],
        slashCommands: [],
        cwd: process.cwd(),
        agents: []
      }
    })

    expect(currentSession.model).toBe('gpt-responses,gpt-5.4-2026-03-05')

    currentSession = {
      ...currentSession,
      status: 'completed'
    }
    adapterSessionStore.clear()
    getMessages.mockReturnValue([
      {
        type: 'message',
        message: {
          id: 'assist-1',
          role: 'assistant',
          content: 'previous answer',
          createdAt: Date.now()
        }
      }
    ])

    await startAdapterSession('sess-1')
  })

  it('restarts the adapter on demand when a follow-up user message arrives after completion', async () => {
    const emit = vi.fn()

    currentSession.status = 'completed'
    getMessages.mockReturnValue([
      {
        type: 'message',
        message: {
          id: 'assist-1',
          role: 'assistant',
          content: 'previous answer',
          createdAt: Date.now()
        }
      }
    ])
    mocks.run.mockResolvedValueOnce({
      session: {
        emit,
        kill: vi.fn()
      }
    })

    await processUserMessage('sess-1', 'follow up')

    expect(mocks.run).toHaveBeenCalledOnce()
    expect(mocks.run.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      type: 'resume',
      sessionId: 'sess-1'
    }))
    expect(emit).toHaveBeenCalledWith({
      type: 'message',
      content: [{ type: 'text', text: 'follow up' }],
      parentUuid: 'assist-1'
    })
    expect(currentSession.status).toBe('running')
    expect(saveMessage).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        type: 'message',
        message: expect.objectContaining({
          role: 'user',
          content: 'follow up'
        })
      })
    )
  })

  it('promotes passive session sockets when a follow-up user message restarts the adapter', async () => {
    const emit = vi.fn()
    const passiveSocket = {
      readyState: 1,
      send: vi.fn()
    }

    currentSession.status = 'completed'
    getMessages.mockReturnValue([
      {
        type: 'message',
        message: {
          id: 'assist-1',
          role: 'assistant',
          content: 'previous answer',
          createdAt: Date.now()
        }
      }
    ])
    externalSessionStore.set('sess-1', {
      sockets: new Set([passiveSocket as any]),
      messages: []
    })
    mocks.run.mockResolvedValueOnce({
      session: {
        emit,
        kill: vi.fn()
      }
    })

    await processUserMessage('sess-1', 'follow up')

    expect(externalSessionStore.has('sess-1')).toBe(false)
    expect(adapterSessionStore.get('sess-1')?.sockets.has(passiveSocket as any)).toBe(true)
    expect(passiveSocket.send).toHaveBeenCalledWith(expect.stringContaining('"type":"message"'))
    expect(emit).toHaveBeenCalledWith({
      type: 'message',
      content: [{ type: 'text', text: 'follow up' }],
      parentUuid: 'assist-1'
    })
  })

  it('routes codex native approval requests through the same interaction flow', async () => {
    const respondInteraction = vi.fn()
    let onEvent: ((event: any) => void) | undefined

    mocks.canRequestInteraction.mockReturnValue(true)
    mocks.requestInteraction.mockResolvedValueOnce('deny_project')
    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      onEvent = adapterOptions.onEvent
      return {
        session: {
          emit: vi.fn(),
          kill: vi.fn(),
          respondInteraction
        }
      }
    })

    await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default'
    })

    onEvent?.({
      type: 'interaction_request',
      data: {
        id: 'approval-1',
        payload: {
          sessionId: 'sess-1',
          kind: 'permission',
          question: '允许执行命令 `pnpm test`？',
          options: [
            { label: '同意本次', value: 'allow_once' },
            { label: '拒绝并在当前项目阻止类似调用', value: 'deny_project' }
          ],
          permissionContext: {
            adapter: 'codex',
            deniedTools: ['Bash'],
            subjectKey: 'Bash',
            subjectLabel: 'Bash',
            scope: 'tool',
            projectConfigPath: '.ai.config.json'
          }
        }
      }
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    await vi.waitFor(() => {
      expect(respondInteraction).toHaveBeenCalledWith('approval-1', 'deny_project')
    })

    expect(updateSessionRuntimeState).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        permissionState: expect.objectContaining({
          deny: ['Bash']
        })
      })
    )
  })

  it('auto-responds to codex native approvals when the session already remembers the tool', async () => {
    const respondInteraction = vi.fn()
    let onEvent: ((event: any) => void) | undefined

    getSessionRuntimeState.mockReturnValue({
      runtimeKind: 'interactive',
      historySeedPending: false,
      permissionState: {
        allow: ['Bash'],
        deny: [],
        onceAllow: [],
        onceDeny: []
      }
    })
    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      onEvent = adapterOptions.onEvent
      return {
        session: {
          emit: vi.fn(),
          kill: vi.fn(),
          respondInteraction
        }
      }
    })

    await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default'
    })

    onEvent?.({
      type: 'interaction_request',
      data: {
        id: 'approval-remembered',
        payload: {
          sessionId: 'sess-1',
          kind: 'permission',
          question: '允许执行命令 `pnpm test`？',
          permissionContext: {
            adapter: 'codex',
            deniedTools: ['Bash'],
            subjectKey: 'Bash',
            subjectLabel: 'Bash',
            scope: 'tool',
            projectConfigPath: '.ai.config.json'
          }
        }
      }
    })

    await vi.waitFor(() => {
      expect(respondInteraction).toHaveBeenCalledWith('approval-remembered', 'allow_session')
    })
    expect(mocks.requestInteraction).not.toHaveBeenCalled()
  })

  it('turns permission errors into a remembered allow interaction and restarts with the same permission mode', async () => {
    const resumedEmit = vi.fn()
    let onEvent: ((event: any) => void) | undefined

    mocks.canRequestInteraction.mockReturnValue(true)
    mocks.requestInteraction.mockResolvedValueOnce('allow_session')
    mocks.run
      .mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
        onEvent = adapterOptions.onEvent
        return {
          session: {
            emit: vi.fn(),
            kill: vi.fn()
          }
        }
      })
      .mockResolvedValueOnce({
        session: {
          emit: resumedEmit,
          kill: vi.fn()
        }
      })

    await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'claude-code',
      permissionMode: 'default'
    })

    onEvent?.({
      type: 'message',
      data: {
        id: 'assist-tool-use',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool-use-1',
            name: 'adapter:claude-code:Write',
            input: {
              file_path: '/tmp/demo.txt',
              content: 'ok'
            }
          }
        ],
        createdAt: Date.now()
      }
    })
    onEvent?.({
      type: 'error',
      data: {
        message: 'Permission required to continue',
        code: 'permission_required',
        details: {
          toolUseId: 'tool-use-1',
          permissionDenials: [
            {
              message: 'Write requires approval',
              deniedTools: []
            }
          ]
        },
        fatal: true
      }
    })
    onEvent?.({
      type: 'exit',
      data: {
        exitCode: 1,
        stderr: 'permission blocked'
      }
    })

    await vi.waitFor(() => {
      expect(currentSession.permissionMode).toBe('default')
      expect(resumedEmit).toHaveBeenCalledWith({
        type: 'message',
        content: [{
          type: 'text',
          text: '权限规则已更新。请继续刚才被权限拦截的工作，并重试被阻止的操作。'
        }]
      })
    })

    expect(updateSessionRuntimeState).toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        permissionState: expect.objectContaining({
          allow: ['Write']
        })
      })
    )
    expect(mocks.requestInteraction).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'sess-1',
      kind: 'permission',
      permissionContext: expect.objectContaining({
        currentMode: 'default',
        deniedTools: ['Write'],
        subjectKey: 'Write',
        subjectLabel: 'Write',
        projectConfigPath: '.ai.config.json'
      })
    }))
  })

  it('suppresses follow-up assistant messages while a permission recovery prompt is pending', async () => {
    let onEvent: ((event: any) => void) | undefined

    mocks.canRequestInteraction.mockReturnValue(true)
    mocks.requestInteraction.mockResolvedValueOnce('allow_once')
    mocks.run
      .mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
        onEvent = adapterOptions.onEvent
        return {
          session: {
            emit: vi.fn(),
            kill: vi.fn()
          }
        }
      })
      .mockResolvedValueOnce({
        session: {
          emit: vi.fn(),
          kill: vi.fn()
        }
      })

    await startAdapterSession('sess-1', {
      model: 'gpt-4o',
      adapter: 'claude-code',
      permissionMode: 'default'
    })

    onEvent?.({
      type: 'error',
      data: {
        message: 'Permission required to continue',
        code: 'permission_required',
        details: {
          permissionDenials: [
            {
              message: 'Write requires approval',
              deniedTools: ['Write']
            }
          ]
        },
        fatal: true
      }
    })
    onEvent?.({
      type: 'message',
      data: {
        id: 'assist-permission-followup',
        role: 'assistant',
        content: '请先授权写文件',
        createdAt: Date.now()
      }
    })
    onEvent?.({
      type: 'exit',
      data: {
        exitCode: 1,
        stderr: 'permission blocked'
      }
    })

    expect(saveMessage).not.toHaveBeenCalledWith(
      'sess-1',
      expect.objectContaining({
        type: 'message',
        message: expect.objectContaining({
          id: 'assist-permission-followup'
        })
      })
    )
  })
})
