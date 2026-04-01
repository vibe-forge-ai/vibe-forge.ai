import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

const {
  resolveRequestLogContext,
  stripRequestLogContextMarker
} = require('../src/ccr/transformers/log-context.js')

const buildMarker = (payload: { ctxId: string, sessionId: string }) =>
  `<VF-CCR-LOG-CONTEXT>${
    Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  }</VF-CCR-LOG-CONTEXT>`

describe('ccr request log context', () => {
  it('resolves request-scoped ctx/session ids from the injected system marker', () => {
    const request = {
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: `${buildMarker({
                ctxId: 'ctx-123',
                sessionId: 'session-456'
              })}\nFollow repo rules`
            }
          ]
        }
      ]
    }
    const context = {
      req: {}
    }

    const parsed = resolveRequestLogContext(context, request)

    expect(parsed).toEqual({
      ctxId: 'ctx-123',
      sessionId: 'session-456'
    })
    expect(context.req).toMatchObject({
      sessionId: 'session-456',
      vfLogContext: {
        ctxId: 'ctx-123',
        sessionId: 'session-456'
      }
    })
  })

  it('strips the injected system marker before forwarding the request', () => {
    const request = {
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: `${buildMarker({
                ctxId: 'ctx-123',
                sessionId: 'session-456'
              })}\nFollow repo rules`
            }
          ]
        }
      ]
    }
    const context = {
      req: {}
    }

    stripRequestLogContextMarker(request, context)

    expect(request.messages[0].content[0].text).toBe('Follow repo rules')
    expect(context.req).toMatchObject({
      sessionId: 'session-456',
      vfLogContext: {
        ctxId: 'ctx-123',
        sessionId: 'session-456'
      }
    })
  })
})
