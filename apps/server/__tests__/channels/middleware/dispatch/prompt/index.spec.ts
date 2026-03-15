import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#~/channels/middleware/dispatch/prompt/agent-rules.js', () => ({
  loadChannelAgentRules: vi.fn()
}))

vi.mock('#~/channels/middleware/dispatch/prompt/context.js', () => ({
  buildChannelContextPrompt: vi.fn()
}))

import { loadChannelAgentRules } from '#~/channels/middleware/dispatch/prompt/agent-rules.js'
import { buildChannelContextPrompt } from '#~/channels/middleware/dispatch/prompt/context.js'
import { buildSessionSystemPrompt } from '#~/channels/middleware/dispatch/prompt/index.js'

const makeInbound = () => ({
  channelType: 'lark',
  channelId: 'ch1',
  sessionType: 'direct' as const,
  messageId: 'm1'
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadChannelAgentRules).mockResolvedValue(undefined)
  vi.mocked(buildChannelContextPrompt).mockReturnValue(undefined)
})

describe('buildSessionSystemPrompt', () => {
  it('joins all four parts with double newline', async () => {
    vi.mocked(buildChannelContextPrompt).mockReturnValue('context')
    vi.mocked(loadChannelAgentRules).mockResolvedValue('agent rules')
    const connection: any = { generateSystemPrompt: vi.fn().mockResolvedValue('conn prompt') }
    const config: any = { systemPrompt: 'base prompt' }

    const result = await buildSessionSystemPrompt(makeInbound() as any, config, connection)

    expect(result).toBe('base prompt\n\ncontext\n\nagent rules\n\nconn prompt')
  })

  it('omits undefined parts', async () => {
    vi.mocked(buildChannelContextPrompt).mockReturnValue('context')
    vi.mocked(loadChannelAgentRules).mockResolvedValue(undefined)

    const result = await buildSessionSystemPrompt(makeInbound() as any, undefined, undefined)

    expect(result).toBe('context')
  })

  it('returns undefined when all parts are absent', async () => {
    const result = await buildSessionSystemPrompt(makeInbound() as any, undefined, undefined)
    expect(result).toBeUndefined()
  })

  it('includes config.systemPrompt when present', async () => {
    const config: any = { systemPrompt: 'injected' }
    const result = await buildSessionSystemPrompt(makeInbound() as any, config, undefined)
    expect(result).toContain('injected')
  })

  it('calls generateSystemPrompt on the connection with inbound', async () => {
    const inbound = makeInbound() as any
    const generateSystemPrompt = vi.fn().mockResolvedValue('dynamic')
    const connection: any = { generateSystemPrompt }

    await buildSessionSystemPrompt(inbound, undefined, connection)

    expect(generateSystemPrompt).toHaveBeenCalledWith(inbound)
  })

  it('works when connection has no generateSystemPrompt method', async () => {
    const connection: any = {}
    const result = await buildSessionSystemPrompt(makeInbound() as any, undefined, connection)
    expect(result).toBeUndefined()
  })

  it('passes channelType to loadChannelAgentRules', async () => {
    await buildSessionSystemPrompt(makeInbound() as any, undefined, undefined)
    expect(loadChannelAgentRules).toHaveBeenCalledWith('lark')
  })
})
