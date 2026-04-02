import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { createT, defineMessages } from '#~/channels/middleware/i18n.js'
import { resolveSessionMiddleware } from '#~/channels/middleware/resolve-session.js'
import { getDb } from '#~/db/index.js'

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

const makeCtx = (): ChannelContext => ({
  channelKey: 'lark:default',
  inbound: { channelType: 'lark', channelId: 'ch1', sessionType: 'direct', messageId: 'm1' } as any,
  connection: undefined,
  config: undefined,
  sessionId: undefined,
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
  resetSession: vi.fn(),
  stopSession: vi.fn(),
  restartSession: vi.fn().mockResolvedValue(undefined),
  updateSession: vi.fn(),
  getChannelAdapterPreference: vi.fn(),
  setChannelAdapterPreference: vi.fn(),
  getChannelPermissionModePreference: vi.fn(),
  setChannelPermissionModePreference: vi.fn(),
  getChannelEffortPreference: vi.fn(),
  setChannelEffortPreference: vi.fn()
})

beforeEach(() => vi.clearAllMocks())

describe('resolveSessionMiddleware', () => {
  it('sets ctx.sessionId when the DB finds a matching session', async () => {
    vi.mocked(getDb).mockReturnValue({
      getChannelSession: vi.fn().mockReturnValue({ sessionId: 'sess-abc' }),
      getChannelPreference: vi.fn().mockReturnValue(undefined)
    } as any)
    const ctx = makeCtx()
    const next = vi.fn().mockResolvedValue(undefined)

    await resolveSessionMiddleware(ctx, next)

    expect(ctx.sessionId).toBe('sess-abc')
    expect(next).toHaveBeenCalledOnce()
  })

  it('leaves ctx.sessionId undefined when no session is found', async () => {
    vi.mocked(getDb).mockReturnValue({
      getChannelSession: vi.fn().mockReturnValue(undefined),
      getChannelPreference: vi.fn().mockReturnValue(undefined)
    } as any)
    const ctx = makeCtx()
    const next = vi.fn().mockResolvedValue(undefined)

    await resolveSessionMiddleware(ctx, next)

    expect(ctx.sessionId).toBeUndefined()
    expect(next).toHaveBeenCalledOnce()
  })

  it('queries using channelType, sessionType, and channelId', async () => {
    const getChannelSession = vi.fn().mockReturnValue(null)
    const getChannelPreference = vi.fn().mockReturnValue(null)
    vi.mocked(getDb).mockReturnValue({ getChannelSession, getChannelPreference } as any)
    const ctx = makeCtx()

    await resolveSessionMiddleware(ctx, vi.fn())

    expect(getChannelSession).toHaveBeenCalledWith('lark', 'direct', 'ch1')
    expect(getChannelPreference).toHaveBeenCalledWith('lark', 'direct', 'ch1')
  })

  it('loads the pending channel adapter preference', async () => {
    vi.mocked(getDb).mockReturnValue({
      getChannelSession: vi.fn().mockReturnValue(undefined),
      getChannelPreference: vi.fn().mockReturnValue({ adapter: 'codex' })
    } as any)
    const ctx = makeCtx()

    await resolveSessionMiddleware(ctx, vi.fn())

    expect(ctx.channelAdapter).toBe('codex')
  })

  it('loads the pending channel permission mode preference', async () => {
    vi.mocked(getDb).mockReturnValue({
      getChannelSession: vi.fn().mockReturnValue(undefined),
      getChannelPreference: vi.fn().mockReturnValue({ permissionMode: 'dontAsk' })
    } as any)
    const ctx = makeCtx()

    await resolveSessionMiddleware(ctx, vi.fn())

    expect(ctx.channelPermissionMode).toBe('dontAsk')
  })
})
