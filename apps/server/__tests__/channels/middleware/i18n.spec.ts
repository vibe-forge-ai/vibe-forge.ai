import { describe, expect, it, vi } from 'vitest'

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { createT, defineMessages, i18nMiddleware } from '#~/channels/middleware/i18n.js'

const makeCtx = (overrides: Partial<ChannelContext> = {}): ChannelContext => ({
  channelKey: 'lark:default',
  configSource: 'project',
  inbound: {
    channelType: 'lark',
    channelId: 'ch1',
    sessionType: 'direct',
    messageId: 'm1'
  } as any,
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
  searchSessions: vi.fn(() => []),
  bindSession: vi.fn(() => ({ alreadyBound: false })),
  unbindSession: vi.fn(() => ({})),
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
  ...overrides,
  resolveSessionWorkspace: overrides.resolveSessionWorkspace ?? vi.fn().mockResolvedValue(undefined)
})

describe('i18nMiddleware', () => {
  it('binds ctx.t to the current config language dynamically', async () => {
    const ctx = makeCtx({
      config: { type: 'lark', language: 'zh' } as any
    })

    await i18nMiddleware(ctx, async () => {
      ctx.defineMessages('zh', {
        'label.yes': '是',
        'system.helpHint': '请发送 {prefix}help 查看支持的命令。'
      })
      ctx.defineMessages('en', {
        'label.yes': 'Yes',
        'system.helpHint': 'Send {prefix}help to see available commands.'
      })

      expect(ctx.t('label.yes')).toBe('是')

      ctx.config = { ...(ctx.config as object), language: 'en' } as any

      expect(ctx.t('label.yes')).toBe('Yes')
      expect(ctx.t('system.helpHint', { prefix: '/' })).toBe('Send /help to see available commands.')
    })
  })
})
