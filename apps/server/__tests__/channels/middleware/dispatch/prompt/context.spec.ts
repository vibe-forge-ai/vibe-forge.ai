import { describe, expect, it } from 'vitest'

import { buildChannelContextPrompt } from '#~/channels/middleware/dispatch/prompt/context.js'

const makeInbound = (overrides: Record<string, unknown> = {}) => ({
  channelType: 'lark',
  channelId: 'ch1',
  sessionType: 'direct' as const,
  messageId: 'm1',
  ...overrides
})

describe('buildChannelContextPrompt', () => {
  it('always includes the platform line', () => {
    const result = buildChannelContextPrompt(makeInbound() as any, undefined)
    expect(result).toContain('你正在通过 飞书（Lark） 频道进行对话。')
  })

  it('uses channelType directly for unknown platforms', () => {
    const result = buildChannelContextPrompt(makeInbound({ channelType: 'wecom' }) as any, undefined)
    expect(result).toContain('你正在通过 wecom 频道进行对话。')
  })

  it('includes bot name when config.title is set', () => {
    const result = buildChannelContextPrompt(makeInbound() as any, { title: 'MyBot' } as any)
    expect(result).toContain('你在此频道上的名字是「MyBot」。')
  })

  it('omits bot name line when config.title is absent', () => {
    const result = buildChannelContextPrompt(makeInbound() as any, {} as any)
    expect(result).not.toContain('名字')
  })

  it('includes admin IDs when admins are configured', () => {
    const config: any = { access: { admins: ['u1', 'u2'] } }
    const result = buildChannelContextPrompt(makeInbound() as any, config)
    expect(result).toContain('u1')
    expect(result).toContain('u2')
    expect(result).toContain('管理员')
  })

  it('omits admin line when admins list is empty', () => {
    const config: any = { access: { admins: [] } }
    const result = buildChannelContextPrompt(makeInbound() as any, config)
    expect(result).not.toContain('管理员')
  })

  it('omits admin line when access is undefined', () => {
    const result = buildChannelContextPrompt(makeInbound() as any, {} as any)
    expect(result).not.toContain('管理员')
  })

  it('returns undefined when config is undefined but platform line is still present', () => {
    // function always returns a string (platform line is always pushed)
    const result = buildChannelContextPrompt(makeInbound() as any, undefined)
    expect(typeof result).toBe('string')
    expect(result!.length).toBeGreaterThan(0)
  })

  it('joins all lines with newline', () => {
    const config: any = { title: 'Bot', access: { admins: ['a1'] } }
    const result = buildChannelContextPrompt(makeInbound() as any, config)!
    const lines = result.split('\n')
    expect(lines).toHaveLength(3)
  })
})
