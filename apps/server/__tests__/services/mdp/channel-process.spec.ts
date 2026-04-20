import { beforeEach, describe, expect, it, vi } from 'vitest'

const bindChannelSession = vi.fn()
const getDb = vi.fn()
const killSession = vi.fn()
const startAdapterSession = vi.fn()
const notifySessionUpdated = vi.fn()
const resolveSessionWorkspace = vi.fn()

vi.mock('#~/channels/middleware/bind-session.js', () => ({
  bindChannelSession
}))

vi.mock('#~/db/index.js', () => ({
  getDb
}))

vi.mock('#~/services/session/index.js', () => ({
  killSession,
  startAdapterSession
}))

vi.mock('#~/services/session/runtime.js', () => ({
  notifySessionUpdated
}))

vi.mock('#~/services/session/workspace.js', () => ({
  resolveSessionWorkspace
}))

describe('channel mdp process helpers', () => {
  let currentBinding: Record<string, any> | undefined
  let currentPreference: Record<string, any> | undefined

  const session = {
    id: 'session-1',
    title: 'Session One',
    status: 'running',
    messageCount: 12,
    model: 'gpt-5.4',
    adapter: 'codex'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    currentBinding = undefined
    currentPreference = undefined

    getDb.mockReturnValue({
      getChannelSession: vi.fn((channelType: string, channelKey: string, sessionType: string, channelId: string) => {
        if (
          currentBinding?.channelType === channelType &&
          currentBinding?.channelKey === channelKey &&
          currentBinding?.sessionType === sessionType &&
          currentBinding?.channelId === channelId
        ) {
          return currentBinding
        }
        return undefined
      }),
      listChannelSessions: vi.fn(() => currentBinding == null ? [] : [currentBinding]),
      getChannelPreference: vi.fn((channelType: string, channelKey: string, sessionType: string, channelId: string) => {
        if (
          currentPreference?.channelType === channelType &&
          currentPreference?.channelKey === channelKey &&
          currentPreference?.sessionType === sessionType &&
          currentPreference?.channelId === channelId
        ) {
          return currentPreference
        }
        return undefined
      }),
      listChannelPreferences: vi.fn(() => currentPreference == null ? [] : [currentPreference]),
      getSession: vi.fn((id: string) => id === session.id ? session : undefined),
      getSessions: vi.fn(() => [session]),
      getChannelSessionBySessionId: vi.fn((sessionId: string) => (
        currentBinding?.sessionId === sessionId ? currentBinding : undefined
      )),
      updateSession: vi.fn(),
      updateSessionArchivedWithChildren: vi.fn(() => [session.id]),
      deleteChannelSession: vi.fn((channelType: string, channelKey: string, sessionType: string, channelId: string) => {
        if (
          currentBinding?.channelType === channelType &&
          currentBinding?.channelKey === channelKey &&
          currentBinding?.sessionType === sessionType &&
          currentBinding?.channelId === channelId
        ) {
          currentBinding = undefined
        }
      }),
      deleteChannelSessionBySessionId: vi.fn((sessionId: string) => {
        if (currentBinding?.sessionId === sessionId) {
          currentBinding = undefined
        }
      }),
      upsertChannelPreference: vi.fn((row: Record<string, any>) => {
        currentPreference = {
          channelType: row.channelType,
          sessionType: row.sessionType,
          channelId: row.channelId,
          channelKey: row.channelKey,
          adapter: row.adapter,
          permissionMode: row.permissionMode,
          effort: row.effort,
          createdAt: currentPreference?.createdAt ?? 1,
          updatedAt: (currentPreference?.updatedAt ?? 1) + 1
        }
      }),
      deleteChannelPreference: vi.fn((channelType: string, channelKey: string, sessionType: string, channelId: string) => {
        if (
          currentPreference?.channelType === channelType &&
          currentPreference?.channelKey === channelKey &&
          currentPreference?.sessionType === sessionType &&
          currentPreference?.channelId === channelId
        ) {
          currentPreference = undefined
        }
      })
    })

    bindChannelSession.mockImplementation((input: Record<string, any>) => {
      currentBinding = {
        channelType: input.channelType,
        sessionType: input.sessionType,
        channelId: input.channelId,
        channelKey: input.channelKey,
        replyReceiveId: input.replyReceiveId,
        replyReceiveIdType: input.replyReceiveIdType,
        sessionId: input.sessionId,
        createdAt: 1,
        updatedAt: 2
      }
      return {
        alreadyBound: false,
        previousSessionId: undefined,
        transferredFrom: undefined
      }
    })
  })

  it('builds a structured command catalog with translated usage', async () => {
    const { resolveChannelCommandCatalog } = await import('#~/services/mdp/channel-process.js')

    const result = resolveChannelCommandCatalog({
      type: 'lark',
      language: 'en',
      commandPrefix: '!'
    })

    expect(result.prefix).toBe('!')
    expect(result.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['session', 'bind'],
          usage: '!session bind <sessionId>',
          permission: 'admin'
        }),
        expect.objectContaining({
          path: ['help'],
          usage: '!help [command...]'
        })
      ])
    )
  })

  it('merges bindings and preferences into normalized channel contexts', async () => {
    currentBinding = {
      channelType: 'lark',
      sessionType: 'direct',
      channelId: 'chat-1',
      channelKey: 'support',
      sessionId: session.id,
      replyReceiveId: 'ou_demo',
      replyReceiveIdType: 'open_id',
      createdAt: 1,
      updatedAt: 5
    }
    currentPreference = {
      channelType: 'lark',
      sessionType: 'direct',
      channelId: 'chat-1',
      channelKey: 'support',
      adapter: 'codex',
      permissionMode: 'dontAsk',
      effort: 'high',
      createdAt: 1,
      updatedAt: 4
    }

    const { resolveChannelContexts } = await import('#~/services/mdp/channel-process.js')

    const result = resolveChannelContexts({
      key: 'support',
      type: 'lark',
      instanceKey: 'support',
      label: 'Lark Support'
    })

    expect(result).toEqual({
      contexts: [
        {
          sessionType: 'direct',
          channelId: 'chat-1',
          binding: {
            sessionId: session.id,
            replyReceiveId: 'ou_demo',
            replyReceiveIdType: 'open_id',
            updatedAt: 5,
            session
          },
          preference: {
            adapter: 'codex',
            permissionMode: 'dontAsk',
            effort: 'high',
            updatedAt: 4
          },
          updatedAt: 5
        }
      ]
    })
  })

  it('executes channel commands through a synthetic mdp context', async () => {
    const { executeChannelCommand } = await import('#~/services/mdp/channel-process.js')

    const result = await executeChannelCommand({
      entry: {
        key: 'support',
        type: 'lark',
        instanceKey: 'support',
        label: 'Lark Support'
      },
      config: {
        type: 'lark',
        language: 'en',
        commandPrefix: '/'
      },
      input: {
        command: '/session bind session-1',
        target: {
          sessionType: 'direct',
          channelId: 'chat-1'
        }
      }
    })

    expect(bindChannelSession).toHaveBeenCalledWith(expect.objectContaining({
      channelType: 'lark',
      sessionType: 'direct',
      channelId: 'chat-1',
      channelKey: 'support',
      sessionId: 'session-1'
    }))
    expect(result.ok).toBe(true)
    expect(result.commandPath).toEqual(['/session', 'bind'])
    expect(result.replies[0]?.text).toContain('session-1')
    expect(result.context).toEqual(expect.objectContaining({
      sessionType: 'direct',
      channelId: 'chat-1',
      binding: expect.objectContaining({
        sessionId: 'session-1'
      })
    }))
  })

  it('exposes direct bind, search and preference helpers for high-frequency channel operations', async () => {
    const {
      bindChannelSessionTarget,
      searchChannelSessions,
      updateChannelPreferenceTarget
    } = await import('#~/services/mdp/channel-process.js')

    const entry = {
      key: 'support',
      type: 'lark',
      instanceKey: 'support',
      label: 'Lark Support'
    }

    const bindResult = bindChannelSessionTarget({
      entry,
      target: {
        sessionType: 'direct',
        channelId: 'chat-1'
      },
      sessionId: session.id
    })

    expect(bindResult.context.binding?.sessionId).toBe(session.id)

    const searchResult = searchChannelSessions({
      entry,
      query: 'session',
      target: {
        sessionType: 'direct',
        channelId: 'chat-1'
      }
    })

    expect(searchResult.sessions[0]?.binding).toEqual(expect.objectContaining({
      channelKey: 'support',
      isCurrentTarget: true
    }))
    expect(searchResult.total).toBe(1)

    const preferenceResult = updateChannelPreferenceTarget({
      entry,
      target: {
        sessionType: 'direct',
        channelId: 'chat-1'
      },
      updates: {
        permissionMode: 'dontAsk',
        effort: 'high'
      }
    })

    expect(preferenceResult.preference).toEqual(expect.objectContaining({
      permissionMode: 'dontAsk',
      effort: 'high'
    }))
    expect(preferenceResult.context.preference).toEqual(expect.objectContaining({
      permissionMode: 'dontAsk',
      effort: 'high'
    }))
  })

  it('clears stored channel preferences when the patch removes every explicit field', async () => {
    currentPreference = {
      channelType: 'lark',
      sessionType: 'direct',
      channelId: 'chat-1',
      channelKey: 'support',
      adapter: 'codex',
      permissionMode: 'dontAsk',
      effort: 'high',
      createdAt: 1,
      updatedAt: 2
    }

    const { updateChannelPreferenceTarget } = await import('#~/services/mdp/channel-process.js')

    const result = updateChannelPreferenceTarget({
      entry: {
        key: 'support',
        type: 'lark',
        instanceKey: 'support',
        label: 'Lark Support'
      },
      target: {
        sessionType: 'direct',
        channelId: 'chat-1'
      },
      updates: {
        adapter: null,
        permissionMode: null,
        effort: null
      }
    })

    expect(result.preference).toBeUndefined()
    expect(result.context.preference).toBeUndefined()
  })
})
