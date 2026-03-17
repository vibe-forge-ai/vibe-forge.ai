import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@vibe-forge/core', async () => {
  const actual = await vi.importActual<typeof import('@vibe-forge/core')>('@vibe-forge/core')
  return {
    ...actual,
    updateConfigFile: vi.fn().mockResolvedValue(undefined)
  }
})

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

vi.mock('#~/channels/state.js', () => ({
  deleteBinding: vi.fn()
}))

vi.mock('#~/websocket/index.js', () => ({
  killSession: vi.fn(),
  startAdapterSession: vi.fn().mockResolvedValue(undefined)
}))

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { channelCommandMiddleware } from '#~/channels/middleware/commands/index.js'
import { createT, defineMessages } from '#~/channels/middleware/i18n.js'
import { deleteBinding } from '#~/channels/state.js'
import { getDb } from '#~/db/index.js'
import { killSession, startAdapterSession } from '#~/websocket/index.js'
import { updateConfigFile } from '@vibe-forge/core'

const deleteChannelSessionBySessionId = vi.fn()
const getSession = vi.fn()
const updateSession = vi.fn()

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
    contentItems: undefined,
    commandText: '',
    defineMessages,
    t: createT(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    pushFollowUps: vi.fn().mockResolvedValue(undefined),
    getBoundSession: vi.fn(),
    resetSession: vi.fn(),
    stopSession: vi.fn(),
    restartSession: vi.fn().mockResolvedValue(undefined),
    updateSession: vi.fn(),
    ...overrides
  }

  // wire up default implementations that reference ctx
  if (!overrides.getBoundSession) {
    ctx.getBoundSession = vi.fn(() => ctx.sessionId ? getSession(ctx.sessionId) : undefined)
  }
  if (!overrides.resetSession) {
    ctx.resetSession = vi.fn(() => {
      if (ctx.sessionId) {
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

  return ctx
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockReturnValue({
    id: 'sess-abc',
    title: 'Session A',
    status: 'running',
    model: 'gpt-test',
    adapter: 'codex',
    permissionMode: 'plan',
    tags: ['tag-a'],
    isArchived: false,
    isStarred: true,
    createdAt: Date.now()
  })
  vi.mocked(getDb).mockReturnValue({
    deleteChannelSessionBySessionId,
    getSession,
    updateSession
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
    expect(String(vi.mocked(ctx.reply).mock.calls[0][0])).toContain('第 1/2 页')
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
    expect(message).toContain('修改当前会话的模型并立即重启')
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
    expect(message).toContain('第 2/2 页')
    expect(message).toContain('/allow <field:sender|group|private|groupchat> <value>')
    expect(ctx.pushFollowUps).toHaveBeenCalledWith({
      messageId: undefined,
      followUps: [{ content: '/help --page=1' }]
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
  })
})

// ── /reset ─────────────────────────────────────────────────────────────────

describe('/reset command — no admins configured', () => {
  it('deletes the session and sends success message', async () => {
    const next = vi.fn()
    const ctx = makeCtx({ commandText: '/reset' })
    await channelCommandMiddleware(ctx, next)

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

  it('/get validates usage', async () => {
    const ctx = makeCtx({ commandText: '/get', config: { type: 'lark' } as any })
    await channelCommandMiddleware(ctx, vi.fn())
    expect(ctx.reply).toHaveBeenCalledWith(
      '缺少参数：<field>\n可选值：\n- model：模型，读取当前会话使用的模型名称。\n- adapter：适配器，读取当前会话绑定的适配器。\n- permissionMode：权限模式，读取当前会话的权限策略。\n用法：/get <field:model|adapter|permissionMode>'
    )
  })

  it('/get model returns the current session model', async () => {
    const ctx = makeCtx({ commandText: '/get model', config: { type: 'lark' } as any })
    await channelCommandMiddleware(ctx, vi.fn())
    expect(ctx.reply).toHaveBeenCalledWith('模型：gpt-test')
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
