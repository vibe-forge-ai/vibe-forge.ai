import { describe, expect, it } from 'vitest'

import { collectCaseMockTrace } from '../../adapter-e2e/harness'
import type { MockLlmTraceEntry, ResolvedAdapterE2ECase } from '../../adapter-e2e/types'

const createTraceEntry = (
  model: string,
  response: MockLlmTraceEntry['response']
): MockLlmTraceEntry => ({
  path: '/chat/completions',
  model,
  requestText: '',
  inputTypes: ['system', 'user'],
  requestedToolCount: 0,
  selectedTool: undefined,
  response
})

describe('collectCaseMockTrace', () => {
  it('filters late trace entries from previous cases by resolved model', () => {
    const resolvedCase: ResolvedAdapterE2ECase = {
      id: 'claude-read-once',
      title: 'Claude read once',
      adapter: 'claude-code',
      prompt: 'prompt',
      model: 'hook-smoke-mock-ccr,claude-read-once',
      allowedTransports: ['wrapper'],
      args: () => [],
      mockScenarios: [],
      expectations: {}
    }
    const trace: MockLlmTraceEntry[] = [
      createTraceEntry('codex-read-once', {
        kind: 'tool',
        tool: {
          name: 'exec_command',
          args: {}
        }
      }),
      createTraceEntry('codex-read-once', {
        kind: 'tool',
        tool: {
          name: 'exec_command',
          args: {}
        }
      }),
      createTraceEntry('claude-read-once', {
        kind: 'tool',
        tool: {
          name: 'Read',
          args: {}
        }
      }),
      createTraceEntry('claude-read-once', {
        kind: 'message',
        text: 'E2E_CLAUDE'
      })
    ]

    expect(collectCaseMockTrace(trace, 1, resolvedCase)).toEqual([
      trace[2],
      trace[3]
    ])
  })
})
