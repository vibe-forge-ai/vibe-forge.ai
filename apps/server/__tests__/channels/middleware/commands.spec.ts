import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { channelCommandMiddleware } from '#~/channels/middleware/commands/index.js'
import { createT, defineMessages } from '#~/channels/middleware/i18n.js'
import { deleteBinding } from '#~/channels/state.js'
import { getDb } from '#~/db/index.js'
import { killSession, startAdapterSession } from '#~/services/session/index.js'
import { updateConfigFile } from '@vibe-forge/config'
import type { SessionWorkspace } from '@vibe-forge/core'

vi.mock('@vibe-forge/config', () => ({
  updateConfigFile: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

vi.mock('#~/channels/state.js', () => ({
  deleteBinding: vi.fn()
}))

vi.mock('#~/services/session/index.js', () => ({
  killSession: vi.fn(),
  startAdapterSession: vi.fn().mockResolvedValue(undefined)
}))

const deleteChannelSessionBySessionId = vi.fn()
const deleteChannelSession = vi.fn()
const getChannelSession = vi.fn()
const getChannelSessionBySessionId = vi.fn()
const getSessions = vi.fn()
const getSession = vi.fn()
const resolveSessionWorkspace = vi.fn()
const updateSession = vi.fn()
const updateSessionArchivedWithChildren = vi.fn()
const upsertChannelPreference = vi.fn()
const upsertChannelSession = vi.fn()

const makeInbound = (overrides: Record<string, unknown> = {}) => ({
  channelType: 'lark',
  channelId: 'ch1',
  sessionType: 'direct' as const,
  messageId: 'm1',
  senderId: 'user1',
  ack: vi.fn().mockResolvedValue(undefined),
  unack: vi.fn().mockResolvedValue(undefined),
  ...overrides
})

const makeCtx = (overrides: Partial<ChannelContext> = {}): ChannelContext => {
  const ctx: ChannelContext = {
    channelKey: 'lark:default',
    configSource: 'project',
    inbound: makeInbound() as any,
    connection: undefined,
    config: undefined,
    sessionId: 'sess-abc',
    channelAdapter: undefined,
    channelPermissionMode: undefined,
    channelEffort: undefined,
    contentItems: undefined,
    commandText: '',
    defineMessages,
    t: createT(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    pushFollowUps: vi.fn().mockResolvedValue(undefined),
    getBoundSession: vi.fn(),
    searchSessions: vi.fn(),
    bindSession: vi.fn(),
    unbindSession: vi.fn(),
    resetSession: vi.fn(),
    stopSession: vi.fn(),
    restartSession: vi.fn().mockResolvedValue(undefined),
    resolveSessionWorkspace: vi.fn(),
    updateSession: vi.fn(),
    getChannelAdapterPreference: vi.fn(() => ctx.channelAdapter),
    setChannelAdapterPreference: vi.fn((adapter?: string) => {
      ctx.channelAdapter = adapter
      upsertChannelPreference({
        channelType: ctx.inbound.channelType,
        sessionType: ctx.inbound.sessionType,
        channelId: ctx.inbound.channelId,
        channelKey: ctx.channelKey,
        adapter,
        permissionMode: ctx.channelPermissionMode
      })
    }),
    getChannelPermissionModePreference: vi.fn(() => ctx.channelPermissionMode),
    setChannelPermissionModePreference: vi.fn((permissionMode) => {
      ctx.channelPermissionMode = permissionMode
      upsertChannelPreference({
        channelType: ctx.inbound.channelType,
        sessionType: ctx.inbound.sessionType,
        channelId: ctx.inbound.channelId,
        channelKey: ctx.channelKey,
        adapter: ctx.channelAdapter,
        permissionMode
      })
    }),
    getChannelEffortPreference: vi.fn(() => ctx.channelEffort),
    setChannelEffortPreference: vi.fn((effort) => {
      ctx.channelEffort = effort
    }),
    ...overrides
  }

  // wire up default implementations that reference ctx
  if (!overrides.getBoundSession) {
    ctx.getBoundSession = vi.fn(() => ctx.sessionId ? getSession(ctx.sessionId) : undefined)
  }
  if (!overrides.searchSessions) {
    ctx.searchSessions = vi.fn((query: string) => {
      const normalized = query.trim().toLowerCase()
      return getSessions()
        .filter((session: any) => {
          const haystack = [
            session.id,
            session.title,
            session.lastMessage,
            session.lastUserMessage,
            session.model,
            session.adapter,
            ...(session.tags ?? [])
          ]
            .filter(Boolean)
            .join('\n')
            .toLowerCase()
          return haystack.includes(normalized)
        })
        .map((session: any) => ({
          session,
          binding: getChannelSessionBySessionId(session.id)
            ? {
              channelType: getChannelSessionBySessionId(session.id).channelType,
              sessionType: getChannelSessionBySessionId(session.id).sessionType,
              channelId: getChannelSessionBySessionId(session.id).channelId,
              channelKey: getChannelSessionBySessionId(session.id).channelKey
            }
            : undefined
        }))
    })
  }
  if (!overrides.bindSession) {
    ctx.bindSession = vi.fn((sessionId: string) => {
      const session = getSession(sessionId)
      if (!session) {
        return { alreadyBound: false }
      }
      const previous = getChannelSession(ctx.inbound.channelType, ctx.channelKey, ctx.inbound.sessionType, ctx.inbound.channelId)
      const transferred = getChannelSessionBySessionId(sessionId)
      if (
        transferred &&
        (
          transferred.channelType !== ctx.inbound.channelType ||
          transferred.channelKey !== ctx.channelKey ||
          transferred.sessionType !== ctx.inbound.sessionType ||
          transferred.channelId !== ctx.inbound.channelId
        )
      ) {
        deleteChannelSession(transferred.channelType, transferred.channelKey, transferred.sessionType, transferred.channelId)
      }
      upsertChannelSession({
        channelType: ctx.inbound.channelType,
        sessionType: ctx.inbound.sessionType,
        channelId: ctx.inbound.channelId,
        channelKey: ctx.channelKey,
        replyReceiveId: ctx.inbound.replyTo?.receiveId,
        replyReceiveIdType: ctx.inbound.replyTo?.receiveIdType,
        sessionId
      })
      ctx.sessionId = sessionId
      return {
        alreadyBound: previous?.sessionId === sessionId,
        session,
        previousSessionId: previous?.sessionId !== sessionId ? previous?.sessionId : undefined,
        transferredFrom: transferred == null
          ? undefined
          : {
            channelType: transferred.channelType,
            sessionType: transferred.sessionType,
            channelId: transferred.channelId,
            channelKey: transferred.channelKey
          }
      }
    })
  }
  if (!overrides.unbindSession) {
    ctx.unbindSession = vi.fn(() => {
      const current = getChannelSession(ctx.inbound.channelType, ctx.channelKey, ctx.inbound.sessionType, ctx.inbound.channelId)
      if (!current?.sessionId) {
        return { sessionId: undefined }
      }
      deleteChannelSession(ctx.inbound.channelType, ctx.channelKey, ctx.inbound.sessionType, ctx.inbound.channelId)
      ctx.sessionId = undefined
      return { sessionId: current.sessionId }
    })
  }
  if (!overrides.resetSession) {
    ctx.resetSession = vi.fn(() => {
      if (ctx.sessionId) {
        updateSessionArchivedWithChildren(ctx.sessionId, true)
        deleteChannelSessionBySessionId(ctx.sessionId)
        deleteBinding(ctx.sessionId)
        ctx.sessionId = undefined
      }
    })
  }
  if (!overrides.stopSession) {
    ctx.stopSession = vi.fn(() => {
      if (ctx.sessionId) killSession(ctx.sessionId)
    })
  }
  if (!overrides.restartSession) {
    ctx.restartSession = vi.fn(async () => {
      if (ctx.sessionId) {
        killSession(ctx.sessionId)
        await startAdapterSession(ctx.sessionId)
      }
    })
  }
  if (!overrides.updateSession) {
    ctx.updateSession = vi.fn((updates) => {
      if (ctx.sessionId) updateSession(ctx.sessionId, updates)
    })
  }
  if (!overrides.resolveSessionWorkspace) {
    ctx.resolveSessionWorkspace = vi.fn(async (sessionId?: string) => {
      const targetSessionId = sessionId ?? ctx.sessionId
      if (targetSessionId == null) {
        return undefined
      }
      return resolveSessionWorkspace(targetSessionId)
    })
  }

  return ctx
}

beforeEach(() => {
  vi.clearAllMocks()
  getChannelSession.mockReturnValue({ sessionId: 'sess-abc' })
  getChannelSessionBySessionId.mockReturnValue(undefined)
  getSession.mockReturnValue({
    id: 'sess-abc',
    title: 'Session A',
    status: 'running',
    messageCount: 12,
    model: 'gpt-test',
    adapter: 'codex',
    permissionMode: 'plan',
    tags: ['tag-a'],
    isArchived: false,
    isStarred: true,
    lastMessage: 'Investigate lark resume failure',
    createdAt: Date.now()
  })
  getSessions.mockReturnValue([
    getSession(),
    {
      id: 'sess-other',
      title: 'Lark handoff window',
      status: 'completed',
      messageCount: 446,
      model: 'gpt-responses,gpt-5.4-2026-03-05',
      adapter: 'codex',
      tags: ['channel:lark:group:oc_790b0dd9fff1f5e216ac15bfbc257556'],
      isArchived: false,
      isStarred: false,
      lastMessage: 'Resume miniapp gear session after interruption',
      createdAt: Date.now()
    }
  ])
  resolveSessionWorkspace.mockImplementation((sessionId: string): SessionWorkspace | undefined => (
    sessionId === 'sess-other'
      ? {
        sessionId,
        kind: 'managed_worktree',
        workspaceFolder: `/tmp/.ai/worktrees/sessions/${sessionId}`,
        repositoryRoot: `/tmp/.ai/worktrees/sessions/${sessionId}`,
        worktreePath: `/tmp/.ai/worktrees/sessions/${sessionId}`,
        baseRef: 'origin/master',
        cleanupPolicy: 'delete_on_session_delete',
        state: 'ready',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      : {
        sessionId,
        kind: 'managed_worktree',
        workspaceFolder: `/tmp/.ai/worktrees/sessions/${sessionId}`,
        repositoryRoot: `/tmp/.ai/worktrees/sessions/${sessionId}`,
        worktreePath: `/tmp/.ai/worktrees/sessions/${sessionId}`,
        baseRef: 'HEAD',
        cleanupPolicy: 'delete_on_session_delete',
        state: 'ready',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
  ))
  vi.mocked(getDb).mockReturnValue({
    deleteChannelSession,
    deleteChannelSessionBySessionId,
    getChannelSession,
    getChannelSessionBySessionId,
    getSession,
    getSessions,
    getChannelPreference: vi.fn().mockReturnValue(undefined),
    upsertChannelSession,
    upsertChannelPreference,
    updateSession,
    updateSessionArchivedWithChildren
  } as any)
})

// ── non-command ────────────────────────────────────────────────────────────

describe('non-command input', () => {
  it('calls next for regular text', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    const ctx = makeCtx({ commandText: 'hello world' })
    await channelCommandMiddleware(ctx, next)
    expect(next).toHaveBeenCalledOnce()
    expect(ctx.reply).not.toHaveBeenCalled()
  })

  it('calls next when commandText is empty', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    await channelCommandMiddleware(makeCtx({ commandText: '' }), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('calls next for unknown slash commands', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    const ctx = makeCtx({ commandText: '/unknown' })
    await channelCommandMiddleware(ctx, next)
    expect(next).toHaveBeenCalledOnce()
    expect(ctx.reply).not.toHaveBeenCalled()
  })
})

// ── /help ──────────────────────────────────────────────────────────────────

describe('/help command', () => {
  it('sends the help message and does not call next', async () => {
    const next = vi.fn()
    const ctx = makeCtx({
      commandText: '/help',
      reply: vi.fn().mockResolvedValue({ messageId: 'om-help-1' }) as any
    })
    await channelCommandMiddleware(ctx, next)

    expect(ctx.reply).toHaveBeenCalledOnce()
    expect(String(vi.mocked(ctx.reply).mock.calls[0][0])).toContain('第 1/3 页')
    expect(ctx.pushFollowUps).toHaveBeenCalledWith({
      messageId: 'om-help-1',
      followUps: [{ content: '/help --page=2' }]
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('calls ack before replying and unack after', async () => {
    const ack = vi.fn().mockResolvedValue(undefined)
    const unack = vi.fn().mockResolvedValue(undefined)
    const ctx = makeCtx({ commandText: '/help', inbound: makeInbound({ ack, unack }) as any })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(ack).toHaveBeenCalledOnce()
    expect(unack).toHaveBeenCalledOnce()
  })

  it('swallows ack errors', async () => {
    const ack = vi.fn().mockRejectedValue(new Error('ack failed'))
    const ctx = makeCtx({ commandText: '/help', inbound: makeInbound({ ack }) as any })
    await expect(channelCommandMiddleware(ctx, vi.fn())).resolves.toBeUndefined()
  })

  it('shows union argument choices in detailed help', async () => {
    const ctx = makeCtx({ commandText: '/help set' })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledOnce()
    const message = String(vi.mocked(ctx.reply).mock.calls[0][0])
    expect(message).toContain('/set <field:model|adapter> <name>')
    expect(message).toContain('model：模型')
    expect(message).toContain('适配器')
  })

  it('falls back to fuzzy search when no exact help target exists', async () => {
    const ctx = makeCtx({ commandText: '/help permiss' })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledOnce()
    const message = String(vi.mocked(ctx.reply).mock.calls[0][0])
    expect(message).toContain('未找到完整匹配')
    expect(message).toContain('/permissionMode <mode:default|acceptEdits|plan|dontAsk|bypassPermissions>')
  })

  it('supports help paging callbacks through explicit page arguments', async () => {
    const ctx = makeCtx({ commandText: '/help --page=2' })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledOnce()
    const message = String(vi.mocked(ctx.reply).mock.calls[0][0])
    expect(message).toContain('第 2/3 页')
    expect(message).toContain('/stop')
    expect(ctx.pushFollowUps).toHaveBeenCalledWith({
      messageId: undefined,
      followUps: [{ content: '/help --page=1' }, { content: '/help --page=3' }]
    })
  })

  it('shows titled choice guidance for invalid values', async () => {
    const ctx = makeCtx({ commandText: '/set wrong gpt-next', config: { type: 'lark' } as any })

    await channelCommandMiddleware(ctx, vi.fn())

    const message = String(vi.mocked(ctx.reply).mock.calls[0][0])
    expect(message).toContain('参数值无效：wrong')
    expect(message).toContain('model(模型)')
    expect(message).toContain('可选值：')
    expect(message).toContain('adapter：适配器')
  })
})

describe('/session command', () => {
  it('shows current session metadata', async () => {
    const ctx = makeCtx({ commandText: '/session' })
    await channelCommandMiddleware(ctx, vi.fn())
    expect(ctx.reply).toHaveBeenCalledOnce()
    expect(String(vi.mocked(ctx.reply).mock.calls[0][0])).toContain('Session A')
    expect(String(vi.mocked(ctx.reply).mock.calls[0][0])).toContain('gpt-test')
    expect(String(vi.mocked(ctx.reply).mock.calls[0][0])).toContain('上下文消息数：12')
    expect(String(vi.mocked(ctx.reply).mock.calls[0][0])).toContain('工作区：/tmp/.ai/worktrees/sessions/sess-abc')
    expect(String(vi.mocked(ctx.reply).mock.calls[0][0])).toContain('工作区模式：托管 worktree')
  })

  it('/session search without query lists recent sessions', async () => {
    const ctx = makeCtx({ commandText: '/session search', config: { type: 'lark' } as any })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(ctx.searchSessions).toHaveBeenCalledWith('')
    expect(ctx.reply).toHaveBeenCalledOnce()
    const message = String(vi.mocked(ctx.reply).mock.calls[0][0])
    expect(message).toContain('最近会话列表')
    expect(message).toContain('第 1/1 页')
    expect(message).toContain('sess-abc')
    expect(message).toContain('sess-other')
  })

  it('/session search lists matching sessions with binding status', async () => {
    getChannelSessionBySessionId.mockImplementation((sessionId: string) => (
      sessionId === 'sess-other'
        ? {
          channelType: 'lark',
          sessionType: 'group',
          channelId: 'oc_790b0dd9fff1f5e216ac15bfbc257556',
          channelKey: 'lark:miniapp-gear'
        }
        : {
          channelType: 'lark',
          sessionType: 'direct',
          channelId: 'ch1',
          channelKey: 'lark:default'
        }
    ))
    const ctx = makeCtx({ commandText: '/session search miniapp gear', config: { type: 'lark' } as any })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledOnce()
    const message = String(vi.mocked(ctx.reply).mock.calls[0][0])
    expect(message).toContain('找到 1 个匹配会话')
    expect(message).toContain('sess-other')
    expect(message).toContain('已绑定 lark/group/oc_790b0dd9fff1f5e216ac15bfbc257556')
  })

  it('/session list supports pagination', async () => {
    getSessions.mockReturnValue(Array.from({ length: 10 }, (_, index) => ({
      id: `sess-${index + 1}`,
      title: `Session ${index + 1}`,
      status: 'completed',
      messageCount: index + 1,
      model: 'gpt-responses,gpt-5.4-2026-03-05',
      adapter: 'codex',
      tags: [],
      isArchived: false,
      isStarred: false,
      createdAt: Date.now() - index
    })))
    const ctx = makeCtx({
      commandText: '/session list --page=2',
      config: { type: 'lark' } as any,
      reply: vi.fn().mockResolvedValue({ messageId: 'om-session-list-2' }) as any
    })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledOnce()
    const message = String(vi.mocked(ctx.reply).mock.calls[0][0])
    expect(message).toContain('最近会话列表（共 10 个）')
    expect(message).toContain('第 2/2 页')
    expect(message).toContain('sess-9')
    expect(message).toContain('sess-10')
    expect(ctx.pushFollowUps).toHaveBeenCalledWith({
      messageId: 'om-session-list-2',
      followUps: [{ content: '/session list --page=1' }]
    })
  })

  it('/session bind rebinds the current channel to an existing session', async () => {
    getSession.mockImplementation((sessionId: string) => (
      sessionId === 'sess-other'
        ? {
          id: 'sess-other',
          title: 'Lark handoff window',
          status: 'completed',
          messageCount: 446,
          model: 'gpt-responses,gpt-5.4-2026-03-05',
          adapter: 'codex',
          tags: [],
          isArchived: false,
          isStarred: false,
          createdAt: Date.now()
        }
        : {
          id: 'sess-abc',
          title: 'Session A',
          status: 'running',
          messageCount: 12,
          model: 'gpt-test',
          adapter: 'codex',
          tags: ['tag-a'],
          isArchived: false,
          isStarred: true,
          createdAt: Date.now()
        }
    ))
    const ctx = makeCtx({ commandText: '/session bind sess-other', config: { type: 'lark' } as any })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(upsertChannelSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'sess-other'
    }))
    expect(ctx.reply).toHaveBeenCalledOnce()
    const message = String(vi.mocked(ctx.reply).mock.calls[0][0])
    expect(message).toContain('已将当前频道绑定到会话 sess-other')
    expect(message).toContain('当前频道原先绑定的会话 sess-abc 已解除绑定')
    expect(message).toContain('工作区：/tmp/.ai/worktrees/sessions/sess-other')
    expect(message).toContain('工作区模式：托管 worktree')
  })

  it('/session unbind detaches the current channel without archiving the session', async () => {
    const ctx = makeCtx({ commandText: '/session unbind', config: { type: 'lark' } as any })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(deleteChannelSession).toHaveBeenCalledWith('lark', 'lark:default', 'direct', 'ch1')
    expect(updateSessionArchivedWithChildren).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledWith('已解除当前频道与会话 sess-abc 的绑定，会话内容已保留。')
  })
})

// ── /reset ─────────────────────────────────────────────────────────────────

describe('/reset command — no admins configured', () => {
  it('archives and unbinds the session and sends success message', async () => {
    const next = vi.fn()
    const ctx = makeCtx({ commandText: '/reset' })
    await channelCommandMiddleware(ctx, next)

    expect(updateSessionArchivedWithChildren).toHaveBeenCalledWith('sess-abc', true)
    expect(deleteChannelSessionBySessionId).toHaveBeenCalledWith('sess-abc')
    expect(deleteBinding).toHaveBeenCalledWith('sess-abc')
    expect(ctx.reply).toHaveBeenCalledOnce()
    expect(next).not.toHaveBeenCalled()
  })

  it('clears ctx.sessionId after reset', async () => {
    const ctx = makeCtx({ commandText: '/reset' })
    await channelCommandMiddleware(ctx, vi.fn())
    expect(ctx.sessionId).toBeUndefined()
  })

  it('still sends success when sessionId is undefined (no active session)', async () => {
    const ctx = makeCtx({ commandText: '/reset', sessionId: undefined })
    await channelCommandMiddleware(ctx, vi.fn())

    expect(updateSessionArchivedWithChildren).not.toHaveBeenCalled()
    expect(deleteChannelSessionBySessionId).not.toHaveBeenCalled()
    expect(deleteBinding).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledOnce()
  })

  it('calls ack and unack', async () => {
    const ack = vi.fn().mockResolvedValue(undefined)
    const unack = vi.fn().mockResolvedValue(undefined)
    const ctx = makeCtx({ commandText: '/reset', inbound: makeInbound({ ack, unack }) as any })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(ack).toHaveBeenCalledOnce()
    expect(unack).toHaveBeenCalledOnce()
  })
})

describe('/reset command — admins configured', () => {
  const configWithAdmins: any = { access: { admins: ['admin1'] } }

  it('allows an admin to reset', async () => {
    const ctx = makeCtx({
      commandText: '/reset',
      config: configWithAdmins,
      inbound: makeInbound({ senderId: 'admin1' }) as any
    })
    await channelCommandMiddleware(ctx, vi.fn())

    expect(updateSessionArchivedWithChildren).toHaveBeenCalledWith('sess-abc', true)
    expect(deleteChannelSessionBySessionId).toHaveBeenCalledWith('sess-abc')
    expect(ctx.reply).toHaveBeenCalledOnce()
  })

  it('blocks a non-admin sender and sends permission error', async () => {
    const next = vi.fn()
    const ctx = makeCtx({
      commandText: '/reset',
      config: configWithAdmins,
      inbound: makeInbound({ senderId: 'user99' }) as any
    })
    await channelCommandMiddleware(ctx, next)

    expect(deleteChannelSessionBySessionId).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledOnce()
    const msg = vi.mocked(ctx.reply).mock.calls[0][0]
    expect(msg).toContain('没有权限')
    expect(next).not.toHaveBeenCalled()
  })

  it('blocks when senderId is absent', async () => {
    const ctx = makeCtx({
      commandText: '/reset',
      config: configWithAdmins,
      inbound: makeInbound({ senderId: undefined }) as any
    })
    await channelCommandMiddleware(ctx, vi.fn())

    expect(deleteChannelSessionBySessionId).not.toHaveBeenCalled()
  })
})

describe('session setting commands', () => {
  it('/permissionMode updates session settings and restarts the session', async () => {
    const ctx = makeCtx({ commandText: '/permissionMode dontAsk', config: { type: 'lark' } as any })
    await channelCommandMiddleware(ctx, vi.fn())

    expect(updateSession).toHaveBeenCalledWith('sess-abc', { permissionMode: 'dontAsk' })
    expect(killSession).toHaveBeenCalledWith('sess-abc')
    expect(startAdapterSession).toHaveBeenCalledWith('sess-abc')
  })

  it('/permissionMode stores the next-session permission mode when no session is bound', async () => {
    const ctx = makeCtx({
      commandText: '/permissionMode dontAsk',
      config: { type: 'lark' } as any,
      sessionId: undefined
    })
    await channelCommandMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledOnce()
    const message = String(vi.mocked(ctx.reply).mock.calls[0][0])
    expect(message).toContain('已将下次会话的权限模式设置为 dontAsk')
    expect(upsertChannelPreference).toHaveBeenCalledWith({
      channelType: 'lark',
      sessionType: 'direct',
      channelId: 'ch1',
      channelKey: 'lark:default',
      adapter: undefined,
      permissionMode: 'dontAsk'
    })
    expect(updateSession).not.toHaveBeenCalled()
    expect(startAdapterSession).not.toHaveBeenCalled()
  })

  it('/permissionMode shows detailed choices when the mode is missing', async () => {
    const ctx = makeCtx({ commandText: '/permissionMode', config: { type: 'lark' } as any })
    await channelCommandMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledWith(
      '缺少参数：<mode>\n可选值：\n- default：默认，使用适配器默认的权限行为。\n- acceptEdits：接受编辑，自动接受编辑类操作。\n- plan：规划，先规划，再等待进一步执行确认。\n- dontAsk：不询问，尽量直接执行，不额外询问。\n- bypassPermissions：绕过权限，跳过大部分权限检查，风险最高。\n用法：/permissionMode <mode:default|acceptEdits|plan|dontAsk|bypassPermissions>'
    )
  })

  it('/set model validates usage', async () => {
    const ctx = makeCtx({ commandText: '/set model', config: { type: 'lark' } as any })
    await channelCommandMiddleware(ctx, vi.fn())
    expect(ctx.reply).toHaveBeenCalledWith('缺少参数：<name>\n用法：/set <field:model|adapter> <name>')
  })

  it('/set adapter stores the next-session adapter when no session is bound', async () => {
    const ctx = makeCtx({
      commandText: '/set adapter codex',
      config: { type: 'lark' } as any,
      sessionId: undefined
    })
    await channelCommandMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledOnce()
    const message = String(vi.mocked(ctx.reply).mock.calls[0][0])
    expect(message).toContain('已将下次会话的适配器设置为 codex')
    expect(upsertChannelPreference).toHaveBeenCalledWith({
      channelType: 'lark',
      sessionType: 'direct',
      channelId: 'ch1',
      channelKey: 'lark:default',
      adapter: 'codex'
    })
  })

  it('/set adapter is rejected when a session is already bound', async () => {
    const ctx = makeCtx({ commandText: '/set adapter codex', config: { type: 'lark' } as any })
    await channelCommandMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledWith('当前频道已有会话，无法切换适配器。请先执行 /reset 重置会话，再设置适配器。')
    expect(upsertChannelPreference).not.toHaveBeenCalled()
    expect(updateSession).not.toHaveBeenCalled()
    expect(startAdapterSession).not.toHaveBeenCalled()
  })

  it('/get validates usage', async () => {
    const ctx = makeCtx({ commandText: '/get', config: { type: 'lark' } as any })
    await channelCommandMiddleware(ctx, vi.fn())
    expect(ctx.reply).toHaveBeenCalledWith(
      '缺少参数：<field>\n可选值：\n- model：模型，读取当前会话使用的模型名称。\n- adapter：适配器，读取当前会话绑定的适配器。\n- permissionMode：权限模式，读取当前会话的权限策略。\n- effort：Effort，读取当前会话的显式 effort 设置。\n用法：/get <field:model|adapter|permissionMode|effort>'
    )
  })

  it('/get model returns the current session model', async () => {
    const ctx = makeCtx({ commandText: '/get model', config: { type: 'lark' } as any })
    await channelCommandMiddleware(ctx, vi.fn())
    expect(ctx.reply).toHaveBeenCalledWith('模型：gpt-test')
  })

  it('/get adapter returns the pending channel adapter when no session is bound', async () => {
    const ctx = makeCtx({
      commandText: '/get adapter',
      config: { type: 'lark' } as any,
      sessionId: undefined,
      channelAdapter: 'codex'
    })
    await channelCommandMiddleware(ctx, vi.fn())
    expect(ctx.reply).toHaveBeenCalledWith('适配器：codex')
  })

  it('/get permissionMode returns the pending channel permission mode when no session is bound', async () => {
    const ctx = makeCtx({
      commandText: '/get permissionMode',
      config: { type: 'lark' } as any,
      sessionId: undefined,
      channelPermissionMode: 'dontAsk'
    })
    await channelCommandMiddleware(ctx, vi.fn())
    expect(ctx.reply).toHaveBeenCalledWith('权限模式：dontAsk')
  })

  it('/set model updates session model and restarts the session', async () => {
    const ctx = makeCtx({ commandText: '/set model gpt-next', config: { type: 'lark' } as any })
    await channelCommandMiddleware(ctx, vi.fn())

    expect(updateSession).toHaveBeenCalledWith('sess-abc', { model: 'gpt-next' })
    expect(killSession).toHaveBeenCalledWith('sess-abc')
    expect(startAdapterSession).toHaveBeenCalledWith('sess-abc')
  })
})

describe('permission config commands', () => {
  it('/allow validates usage', async () => {
    const ctx = makeCtx({
      commandText: '/allow sender',
      config: { type: 'lark', access: { admins: ['admin1'] } } as any,
      inbound: makeInbound({ senderId: 'admin1' }) as any
    })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(ctx.reply).toHaveBeenCalledWith(
      '缺少参数：<value>\n用法：/allow <field:sender|group|private|groupchat> <value>'
    )
  })

  it('/admin add writes updated channel config', async () => {
    const ctx = makeCtx({
      commandText: '/admin add admin2',
      config: { type: 'lark', access: { admins: ['admin1'] } } as any,
      inbound: makeInbound({ senderId: 'admin1' }) as any
    })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(updateConfigFile).toHaveBeenCalledWith(expect.objectContaining({
      source: 'project',
      section: 'channels',
      value: {
        'lark:default': {
          type: 'lark',
          access: {
            admins: ['admin1', 'admin2']
          }
        }
      }
    }))
  })

  it('/block group writes updated channel config', async () => {
    const ctx = makeCtx({
      commandText: '/block group group2',
      config: { type: 'lark', access: { admins: ['admin1'] } } as any,
      inbound: makeInbound({ senderId: 'admin1' }) as any
    })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(updateConfigFile).toHaveBeenCalledWith(expect.objectContaining({
      source: 'project',
      section: 'channels',
      value: {
        'lark:default': {
          type: 'lark',
          access: {
            admins: ['admin1'],
            blockedGroups: ['group2']
          }
        }
      }
    }))
  })

  it('blocks non-admin users from mutation commands when admins are configured', async () => {
    const ctx = makeCtx({
      commandText: '/allow sender user2',
      config: { type: 'lark', access: { admins: ['admin1'] } } as any,
      inbound: makeInbound({ senderId: 'user1' }) as any
    })

    await channelCommandMiddleware(ctx, vi.fn())

    expect(updateConfigFile).not.toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledOnce()
    expect(String(vi.mocked(ctx.reply).mock.calls[0][0])).toContain('没有权限')
  })
})
