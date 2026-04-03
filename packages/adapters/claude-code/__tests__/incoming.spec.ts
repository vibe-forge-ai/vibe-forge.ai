import { describe, expect, it } from 'vitest'

import type { AdapterOutputEvent } from '@vibe-forge/types'

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
    }, (event: AdapterOutputEvent) => events.push(event))

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
    }, (event: AdapterOutputEvent) => events.push(event))

    expect(events).toEqual([
      {
        type: 'error',
        data: {
          message: 'API Error: 400 {"error":{"message":"Mock bad request"}}',
          code: undefined,
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
            permissionDenials: [],
            rawPermissionDenials: []
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

  it('normalizes permission denials into a structured permission_required error', () => {
    const events: AdapterOutputEvent[] = []

    handleIncomingEvent({
      type: 'result',
      subtype: 'success',
      uuid: 'evt-3',
      timestamp: new Date().toISOString(),
      sessionId: 'sess-3',
      cwd: '/tmp',
      is_error: true,
      duration_ms: 123,
      duration_api_ms: 45,
      num_turns: 1,
      result: 'Tool call blocked because permission is required.',
      session_id: 'sess-3',
      total_cost_usd: 0,
      usage: {
        input_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 0
      },
      permission_denials: [
        {
          message: 'Write requires approval',
          tool_name: 'Write'
        }
      ]
    }, (event: AdapterOutputEvent) => events.push(event))

    expect(events[0]).toEqual({
      type: 'error',
      data: {
        message: 'Permission required to continue',
        code: 'permission_required',
        details: {
          sessionId: 'sess-3',
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
          permissionDenials: [
            {
              message: 'Write requires approval',
              deniedTools: ['Write']
            }
          ],
          rawPermissionDenials: [
            {
              message: 'Write requires approval',
              tool_name: 'Write'
            }
          ]
        },
        fatal: true
      }
    })
  })

  it('surfaces permission-denied tool results as a structured permission_required error', () => {
    const events: AdapterOutputEvent[] = []

    handleIncomingEvent({
      type: 'user',
      uuid: 'evt-4',
      timestamp: new Date().toISOString(),
      sessionId: 'sess-4',
      cwd: '/tmp',
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'tool-1',
          is_error: true,
          content: "Claude requested permissions to write to /tmp/test.js, but you haven't granted it yet."
        }]
      }
    }, (event: AdapterOutputEvent) => events.push(event))

    expect(events).toEqual([
      {
        type: 'message',
        data: {
          id: 'evt-4',
          role: 'assistant',
          content: [{
            type: 'tool_result',
            tool_use_id: 'tool-1',
            content: "Claude requested permissions to write to /tmp/test.js, but you haven't granted it yet.",
            is_error: true
          }],
          createdAt: expect.any(Number)
        }
      },
      {
        type: 'error',
        data: {
          message: 'Permission required to continue',
          code: 'permission_required',
          details: {
            toolUseId: 'tool-1',
            permissionDenials: [{
              message: "Claude requested permissions to write to /tmp/test.js, but you haven't granted it yet.",
              deniedTools: []
            }],
            rawPermissionDenial:
              "Claude requested permissions to write to /tmp/test.js, but you haven't granted it yet."
          },
          fatal: true
        }
      }
    ])
  })
})
