import { afterEach, describe, expect, it, vi } from 'vitest'

describe('session detail url', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults to localhost ui routes when no public base is configured', async () => {
    const {
      buildChannelActionUrl,
      buildSessionDetailUrl,
      buildToolCallDetailUrl,
      resolveChannelServerBaseUrl
    } =
      await import('#~/channels/session-detail-url.js')

    expect(resolveChannelServerBaseUrl(undefined)).toBe('http://localhost:8787')

    expect(buildSessionDetailUrl(undefined, {
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      messageId: 'msg-1'
    })).toBe('http://localhost:8787/ui/session/sess-1?toolUseId=tool-1&messageId=msg-1')

    expect(buildChannelActionUrl(undefined, {
      action: 'tool-call-export',
      sessionId: 'sess-1',
      toolUseId: 'tool-1'
    })).toBe('http://localhost:8787/channels/actions/tool-call-export?sessionId=sess-1&toolUseId=tool-1')

    expect(buildToolCallDetailUrl(undefined, {
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      messageId: 'msg-1'
    })).toBe('http://localhost:8787/channels/actions/tool-call-detail?sessionId=sess-1&toolUseId=tool-1&messageId=msg-1')
  })

  it('prefers the channel sessionDetailBaseUrl over env defaults', async () => {
    vi.stubEnv('__VF_PROJECT_AI_PUBLIC_BASE_URL__', 'https://lan.example')

    const { buildSessionDetailUrl } = await import('#~/channels/session-detail-url.js')

    expect(buildSessionDetailUrl({
      type: 'lark',
      sessionDetailBaseUrl: 'https://bot.example.com/custom-ui'
    }, {
      sessionId: 'sess-1',
      toolUseId: 'tool-1'
    })).toBe('https://bot.example.com/custom-ui/session/sess-1?toolUseId=tool-1')
  })

  it('prefers the channel serverBaseUrl for server action links', async () => {
    vi.stubEnv('__VF_PROJECT_AI_PUBLIC_BASE_URL__', 'https://lan.example')

    const { buildChannelActionUrl } = await import('#~/channels/session-detail-url.js')

    expect(buildChannelActionUrl({
      type: 'lark',
      serverBaseUrl: 'https://bot.example.com/internal'
    }, {
      action: 'tool-call-export',
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      messageId: 'msg-1'
    })).toBe(
      'https://bot.example.com/internal/channels/actions/tool-call-export?sessionId=sess-1&toolUseId=tool-1&messageId=msg-1'
    )
  })
})
