import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { syncChannelSessionBinding } from '#~/channels/middleware/bind-session.js'
import { dispatchMiddleware } from '#~/channels/middleware/dispatch/index.js'
import { createT, defineMessages } from '#~/channels/middleware/i18n.js'
import { createSessionWithInitialMessage } from '#~/services/session/create.js'
import { processUserMessage } from '#~/services/session/index.js'

vi.mock('#~/services/session/create.js', () => ({
  createSessionWithInitialMessage: vi.fn()
}))

vi.mock('#~/services/session/index.js', () => ({
  processUserMessage: vi.fn()
}))

vi.mock('#~/channels/middleware/bind-session.js', () => ({
  syncChannelSessionBinding: vi.fn()
}))

vi.mock('#~/channels/middleware/dispatch/prompt.js', () => ({
  buildSessionSystemPrompt: vi.fn().mockResolvedValue('system-prompt')
}))

const makeCtx = (overrides: Partial<ChannelContext> = {}): ChannelContext => ({
  channelKey: 'lark:default',
  inbound: {
    channelType: 'lark',
    channelId: 'ch1',
    sessionType: 'direct',
    messageId: 'm1',
    senderId: 'user1',
    text: 'hello world'
  } as any,
  connection: undefined,
  config: undefined,
  sessionId: undefined,
  channelAdapter: undefined,
  channelPermissionMode: undefined,
  channelEffort: undefined,
  contentItems: undefined,
  commandText: 'hello world',
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
  setChannelEffortPreference: vi.fn(),
  ...overrides
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createSessionWithInitialMessage).mockResolvedValue({ id: 'new-sess' } as any)
})

describe('dispatchMiddleware', () => {
  describe('new session (no sessionId)', () => {
    it('creates a session with text message', async () => {
      const ctx = makeCtx()
      const next = vi.fn().mockResolvedValue(undefined)

      await dispatchMiddleware(ctx, next)

      expect(createSessionWithInitialMessage).toHaveBeenCalledOnce()
      const args = vi.mocked(createSessionWithInitialMessage).mock.calls[0][0]
      expect(args.initialMessage).toBe('hello world')
      expect(args.initialContent).toBeUndefined()
      expect(args.shouldStart).toBe(true)
    })

    it('sets ctx.sessionId to the newly created session id', async () => {
      const ctx = makeCtx()
      await dispatchMiddleware(ctx, vi.fn().mockResolvedValue(undefined))
      expect(ctx.sessionId).toBe('new-sess')
    })

    it('uses the pending channel adapter when creating a new session', async () => {
      const ctx = makeCtx({ channelAdapter: 'codex' })

      await dispatchMiddleware(ctx, vi.fn().mockResolvedValue(undefined))

      const args = vi.mocked(createSessionWithInitialMessage).mock.calls[0][0]
      expect(args.adapter).toBe('codex')
    })

    it('uses the pending channel permission mode when creating a new session', async () => {
      const ctx = makeCtx({ channelPermissionMode: 'dontAsk' })

      await dispatchMiddleware(ctx, vi.fn().mockResolvedValue(undefined))

      const args = vi.mocked(createSessionWithInitialMessage).mock.calls[0][0]
      expect(args.permissionMode).toBe('dontAsk')
    })

    it('uses contentItems when present instead of text', async () => {
      const contentItems = [{ type: 'text', text: 'rich' }] as any
      const ctx = makeCtx({ contentItems })

      await dispatchMiddleware(ctx, vi.fn().mockResolvedValue(undefined))

      const args = vi.mocked(createSessionWithInitialMessage).mock.calls[0][0]
      expect(args.initialContent).toEqual(contentItems)
      expect(args.initialMessage).toBeUndefined()
    })

    it('builds direct channel tags', async () => {
      const ctx = makeCtx()
      await dispatchMiddleware(ctx, vi.fn().mockResolvedValue(undefined))

      const args = vi.mocked(createSessionWithInitialMessage).mock.calls[0][0]
      expect(args.tags).toContain('channel:lark:direct:user1')
    })

    it('builds group channel tags', async () => {
      const ctx = makeCtx({
        inbound: { channelType: 'lark', channelId: 'grp1', sessionType: 'group', messageId: 'm1', text: 'hi' } as any
      })
      await dispatchMiddleware(ctx, vi.fn().mockResolvedValue(undefined))

      const args = vi.mocked(createSessionWithInitialMessage).mock.calls[0][0]
      expect(args.tags).toContain('channel:lark:group:grp1')
    })

    it('calls next after session creation', async () => {
      const next = vi.fn().mockResolvedValue(undefined)
      await dispatchMiddleware(makeCtx(), next)
      expect(next).toHaveBeenCalledOnce()
    })

    it('syncs the channel binding before starting the first adapter run', async () => {
      let beforeStart: ((sessionId: string) => Promise<void> | void) | undefined
      vi.mocked(createSessionWithInitialMessage).mockImplementationOnce(async (options) => {
        beforeStart = options.beforeStart
        await options.beforeStart?.('new-sess')
        return { id: 'new-sess' } as any
      })

      await dispatchMiddleware(makeCtx(), vi.fn().mockResolvedValue(undefined))

      expect(beforeStart).toBeTypeOf('function')
      expect(syncChannelSessionBinding).toHaveBeenCalledWith({
        channelKey: 'lark:default',
        inbound: expect.objectContaining({
          channelType: 'lark',
          channelId: 'ch1',
          sessionType: 'direct'
        }),
        sessionId: 'new-sess'
      })
    })
  })

  describe('existing session (sessionId present)', () => {
    it('forwards text message to processUserMessage', async () => {
      const ctx = makeCtx({ sessionId: 'existing-sess' })
      await dispatchMiddleware(ctx, vi.fn().mockResolvedValue(undefined))

      expect(processUserMessage).toHaveBeenCalledWith('existing-sess', 'hello world')
      expect(createSessionWithInitialMessage).not.toHaveBeenCalled()
    })

    it('forwards contentItems when present', async () => {
      const contentItems = [{ type: 'image', url: 'http://img' }] as any
      const ctx = makeCtx({ sessionId: 'existing-sess', contentItems })

      await dispatchMiddleware(ctx, vi.fn().mockResolvedValue(undefined))

      expect(processUserMessage).toHaveBeenCalledWith('existing-sess', contentItems)
    })

    it('calls next after forwarding', async () => {
      const next = vi.fn().mockResolvedValue(undefined)
      await dispatchMiddleware(makeCtx({ sessionId: 'existing-sess' }), next)
      expect(next).toHaveBeenCalledOnce()
    })
  })
})
