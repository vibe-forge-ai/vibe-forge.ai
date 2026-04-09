import { afterEach, describe, expect, it, vi } from 'vitest'

describe('session detail url', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults to localhost ui routes when no public base is configured', async () => {
    vi.stubEnv('__VF_PROJECT_AI_SERVER_ACTION_SECRET__', 'test-secret')
    const {
      buildChannelActionUrl,
      buildSessionDetailUrl,
      buildToolCallDetailUrl,
      resolveChannelServerBaseUrl
    } =
      await import('#~/channels/session-detail-url.js')
    const { verifyChannelActionToken } = await import('#~/channels/action-token.js')

    expect(resolveChannelServerBaseUrl(undefined)).toBe('http://localhost:8787')

    expect(buildSessionDetailUrl(undefined, {
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      messageId: 'msg-1'
    })).toBe('http://localhost:8787/ui/session/sess-1?toolUseId=tool-1&messageId=msg-1')

    const actionUrl = buildChannelActionUrl(undefined, {
      action: 'tool-call-export',
      sessionId: 'sess-1',
      toolUseId: 'tool-1'
    })
    expect(actionUrl).toBeDefined()
    if (actionUrl == null) {
      throw new Error('Expected actionUrl to be defined')
    }
    const actionToken = new URL(actionUrl).searchParams.get('token') ?? ''
    expect(new URL(actionUrl).origin + new URL(actionUrl).pathname).toBe('http://localhost:8787/channels/actions/tool-call-export')
    expect(verifyChannelActionToken(actionToken, 'tool-call-export')).toEqual({
      ok: true,
      claims: expect.objectContaining({
        action: 'tool-call-export',
        sessionId: 'sess-1',
        toolUseId: 'tool-1',
        oneTime: true
      })
    })

    const detailUrl = buildToolCallDetailUrl(undefined, {
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      messageId: 'msg-1'
    })
    expect(detailUrl).toBeDefined()
    if (detailUrl == null) {
      throw new Error('Expected detailUrl to be defined')
    }
    const detailToken = new URL(detailUrl).searchParams.get('token') ?? ''
    expect(new URL(detailUrl).origin + new URL(detailUrl).pathname).toBe('http://localhost:8787/channels/actions/tool-call-detail')
    expect(verifyChannelActionToken(detailToken, 'tool-call-detail')).toEqual({
      ok: true,
      claims: expect.objectContaining({
        action: 'tool-call-detail',
        sessionId: 'sess-1',
        sessionUrl: 'http://localhost:8787/ui/session/sess-1?toolUseId=tool-1&messageId=msg-1',
        toolUseId: 'tool-1',
        messageId: 'msg-1',
        oneTime: false
      })
    })
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
    vi.stubEnv('__VF_PROJECT_AI_SERVER_ACTION_SECRET__', 'test-secret')

    const { buildChannelActionUrl } = await import('#~/channels/session-detail-url.js')
    const { verifyChannelActionToken } = await import('#~/channels/action-token.js')

    const actionUrl = buildChannelActionUrl({
      type: 'lark',
      serverBaseUrl: 'https://bot.example.com/internal'
    }, {
      action: 'tool-call-export',
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      messageId: 'msg-1'
    })
    expect(actionUrl).toBeDefined()
    if (actionUrl == null) {
      throw new Error('Expected actionUrl to be defined')
    }

    const parsed = new URL(actionUrl)
    expect(`${parsed.origin}${parsed.pathname}`).toBe('https://bot.example.com/internal/channels/actions/tool-call-export')
    expect(verifyChannelActionToken(parsed.searchParams.get('token') ?? '', 'tool-call-export')).toEqual({
      ok: true,
      claims: expect.objectContaining({
        sessionId: 'sess-1',
        toolUseId: 'tool-1',
        messageId: 'msg-1'
      })
    })
  })

  it('does not generate action links when the signing secret is missing', async () => {
    const { buildChannelActionUrl, buildToolCallDetailUrl } = await import('#~/channels/session-detail-url.js')

    expect(buildChannelActionUrl(undefined, {
      action: 'tool-call-export',
      sessionId: 'sess-1',
      toolUseId: 'tool-1'
    })).toBeUndefined()

    expect(buildToolCallDetailUrl(undefined, {
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      messageId: 'msg-1'
    })).toBeUndefined()
  })
})
