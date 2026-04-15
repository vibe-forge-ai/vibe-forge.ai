import { describe, expect, it, vi } from 'vitest'

import type { ChannelContext } from '#~/channels/middleware/@types/index.js'
import { getInboundContentItems, stripLeadingAtTags, stripSpeakerPrefix } from '#~/channels/middleware/@utils/index.js'
import { createT, defineMessages } from '#~/channels/middleware/i18n.js'
import { parseContentMiddleware } from '#~/channels/middleware/parse-content.js'

// ── stripSpeakerPrefix ──────────────────────────────────────────────────────

describe('stripSpeakerPrefix', () => {
  it('removes a [Name]: prefix on the first line', () => {
    expect(stripSpeakerPrefix('[Alice]:\nhello')).toBe('hello')
  })

  it('leaves single-line text untouched', () => {
    expect(stripSpeakerPrefix('hello')).toBe('hello')
  })

  it('leaves multi-line text without the marker untouched', () => {
    expect(stripSpeakerPrefix('line1\nline2')).toBe('line1\nline2')
  })

  it('handles indented first-line markers', () => {
    expect(stripSpeakerPrefix('  [Bob]:\nworld')).toBe('world')
  })
})

// ── stripLeadingAtTags ──────────────────────────────────────────────────────

describe('stripLeadingAtTags', () => {
  it('strips a single leading at-tag', () => {
    expect(stripLeadingAtTags('<at id="1">bot</at> hello')).toBe(' hello')
  })

  it('strips multiple consecutive at-tags', () => {
    expect(stripLeadingAtTags('<at id="1">a</at><at id="2">b</at> hi')).toBe(' hi')
  })

  it('leaves text without at-tags unchanged', () => {
    expect(stripLeadingAtTags('hello world')).toBe('hello world')
  })

  it('leaves at-tags that are not at the start', () => {
    expect(stripLeadingAtTags('hey <at id="1">you</at>')).toBe('hey <at id="1">you</at>')
  })

  it('returns text unchanged when <at is unclosed', () => {
    expect(stripLeadingAtTags('<at id="1">no close')).toBe('<at id="1">no close')
  })
})

// ── getInboundContentItems ──────────────────────────────────────────────────

describe('getInboundContentItems', () => {
  it('returns undefined when raw is not a record', () => {
    expect(getInboundContentItems({ raw: 'string' } as any)).toBeUndefined()
    expect(getInboundContentItems({ raw: null } as any)).toBeUndefined()
  })

  it('returns undefined when raw.contentItems is not an array', () => {
    expect(getInboundContentItems({ raw: { contentItems: 'bad' } } as any)).toBeUndefined()
  })

  it('returns undefined when an item fails validation', () => {
    const inbound = { raw: { contentItems: [{ type: 'text', text: 123 }] } } as any
    expect(getInboundContentItems(inbound)).toBeUndefined()
  })

  it('returns parsed text items', () => {
    const inbound = { raw: { contentItems: [{ type: 'text', text: 'hi' }] } } as any
    expect(getInboundContentItems(inbound)).toEqual([{ type: 'text', text: 'hi' }])
  })

  it('returns parsed image items', () => {
    const item = { type: 'image', url: 'https://img', name: 'pic.png', size: 100, mimeType: 'image/png' }
    const inbound = { raw: { contentItems: [item] } } as any
    expect(getInboundContentItems(inbound)).toEqual([item])
  })
})

// ── parseContentMiddleware ──────────────────────────────────────────────────

const makeCtx = (overrides: Partial<ChannelContext> = {}): ChannelContext => ({
  channelKey: 'lark:default',
  inbound: {
    channelType: 'lark',
    channelId: 'ch1',
    sessionType: 'direct',
    messageId: 'm1',
    text: 'hello',
    raw: {}
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

describe('parseContentMiddleware', () => {
  it('calls next and fills commandText for plain text', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    const ctx = makeCtx()

    await parseContentMiddleware(ctx, next)

    expect(next).toHaveBeenCalledOnce()
    expect(ctx.commandText).toBe('hello')
  })

  it('stops the chain when text is empty and no content items', async () => {
    const next = vi.fn()
    const ctx = makeCtx({
      inbound: {
        channelType: 'lark',
        channelId: 'ch1',
        sessionType: 'direct',
        messageId: 'm1',
        text: '',
        raw: {}
      } as any
    })

    await parseContentMiddleware(ctx, next)

    expect(next).not.toHaveBeenCalled()
  })

  it('continues when text is empty but contentItems exist', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    const ctx = makeCtx({
      inbound: {
        channelType: 'lark',
        channelId: 'ch1',
        sessionType: 'direct',
        messageId: 'm1',
        text: '',
        raw: { contentItems: [{ type: 'text', text: 'img content' }] }
      } as any
    })

    await parseContentMiddleware(ctx, next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('strips leading at-tags and speaker prefix for commandText', async () => {
    const next = vi.fn().mockResolvedValue(undefined)
    const ctx = makeCtx({
      inbound: { ...makeCtx().inbound, text: '[Alice]:\n<at id="1">bot</at> /reset' } as any
    })

    await parseContentMiddleware(ctx, next)

    expect(ctx.commandText).toBe('/reset')
  })
})
