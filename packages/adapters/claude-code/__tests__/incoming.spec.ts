import { describe, expect, it } from 'vitest'

import type { AdapterOutputEvent } from '@vibe-forge/core/adapter'

import { handleIncomingEvent } from '../src/protocol/incoming'

describe('claude-code incoming error handling', () => {
  it('emits a standard error event for error_during_execution results', () => {
    const events: AdapterOutputEvent[] = []

    handleIncomingEvent({
      type: 'result',
      subtype: 'error_during_execution',
      uuid: 'evt-1',
      timestamp: new Date().toISOString(),
      sessionId: 'sess-1',
      cwd: '/tmp',
      session_id: 'sess-1',
      errors: ['Incomplete response returned', 'reason=max_output_tokens']
    }, (event) => events.push(event))

    expect(events).toEqual([
      {
        type: 'error',
        data: {
          message: 'Incomplete response returned',
          details: {
            errors: ['Incomplete response returned', 'reason=max_output_tokens'],
            sessionId: 'sess-1'
          },
          fatal: true
        }
      }
    ])
  })

  it('emits a standard error event for success results flagged as is_error', () => {
    const events: AdapterOutputEvent[] = []

    handleIncomingEvent({
      type: 'result',
      subtype: 'success',
      uuid: 'evt-2',
      timestamp: new Date().toISOString(),
      sessionId: 'sess-2',
      cwd: '/tmp',
      is_error: true,
      duration_ms: 123,
      duration_api_ms: 45,
      num_turns: 1,
      result: 'API Error: 400 {"error":{"message":"Mock bad request"}}',
      session_id: 'sess-2',
      total_cost_usd: 0,
      usage: {
        input_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 0
      },
      permission_denials: []
    }, (event) => events.push(event))

    expect(events).toEqual([
      {
        type: 'error',
        data: {
          message: 'API Error: 400 {"error":{"message":"Mock bad request"}}',
          details: {
            sessionId: 'sess-2',
            durationMs: 123,
            durationApiMs: 45,
            numTurns: 1,
            totalCostUsd: 0,
            usage: {
              input_tokens: 0,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
              output_tokens: 0
            },
            permissionDenials: []
          },
          fatal: true
        }
      },
      {
        type: 'stop',
        data: {
          id: 'evt-2',
          role: 'assistant',
          content: 'API Error: 400 {"error":{"message":"Mock bad request"}}',
          createdAt: expect.any(Number),
          usage: {
            input_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            output_tokens: 0
          }
        }
      }
    ])
  })
})
