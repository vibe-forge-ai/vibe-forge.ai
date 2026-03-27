import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, fetchApiJson, fetchApiJsonOrThrow, getApiErrorMessage } from '#~/api/base'

vi.mock('#~/runtime-config.js', () => ({
  getServerHostEnv: () => 'api.example.com',
  getServerPortEnv: () => '8787'
}))

const makeJsonResponse = (body: unknown, init?: ResponseInit) => {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  })
}

describe('api base helpers', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('unwraps success envelopes returned by the server', async () => {
    fetchMock.mockResolvedValue(
      makeJsonResponse({
        success: true,
        data: { sessions: [{ id: 'sess-1' }] }
      })
    )

    await expect(fetchApiJson<{ sessions: Array<{ id: string }> }>('/api/sessions')).resolves.toEqual({
      sessions: [{ id: 'sess-1' }]
    })
    expect(fetchMock).toHaveBeenCalledWith('http://api.example.com:8787/api/sessions', undefined)
  })

  it('keeps supporting legacy success payloads', async () => {
    fetchMock.mockResolvedValue(
      makeJsonResponse({
        ok: true,
        removed: false
      })
    )

    await expect(fetchApiJson<{ ok: boolean; removed: boolean }>('/api/automation/rules/rule-1')).resolves.toEqual({
      ok: true,
      removed: false
    })
  })

  it('maps api error envelopes to ApiError instances', async () => {
    fetchMock.mockResolvedValue(
      makeJsonResponse({
        success: false,
        error: {
          code: 'invalid_payload',
          message: 'Invalid payload',
          details: { field: 'prompt' }
        }
      }, { status: 400 })
    )

    await expect(
      fetchApiJsonOrThrow('/api/automation/rules', { method: 'POST' }, '[api] create rule failed')
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'invalid_payload',
      message: 'Invalid payload',
      details: { field: 'prompt' }
    })
    expect(console.error).toHaveBeenCalledWith(
      '[api] create rule failed',
      400,
      'Invalid payload',
      { field: 'prompt' }
    )
  })

  it('falls back to legacy text errors when the response is not enveloped', async () => {
    fetchMock.mockResolvedValue(new Response('gateway timeout', { status: 504 }))

    await expect(fetchApiJson('/api/hooks')).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiError',
        status: 504,
        code: 'request_failed',
        message: 'gateway timeout'
      })
    )
  })

  it('prefers ApiError messages when formatting failures', () => {
    const error = new ApiError(409, {
      code: 'rule_disabled',
      message: 'Rule disabled'
    })

    expect(getApiErrorMessage(error, 'unknown')).toBe('Rule disabled')
    expect(getApiErrorMessage(new Error('boom'), 'unknown')).toBe('boom')
    expect(getApiErrorMessage({}, 'unknown')).toBe('unknown')
  })
})
