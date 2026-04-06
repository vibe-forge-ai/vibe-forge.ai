import { afterEach, describe, expect, it } from 'vitest'

import {
  createRuleBasedMockScenario,
  defineMockScenarioRule,
  messageTurn,
  selectedToolTurn,
  whenRequestTextIncludes,
  whenTitleGeneration,
  whenToolResult,
  whenToolsAvailable
} from '../../adapter-e2e/mock-llm/rules'
import { buildResponsesToolCall } from '../../adapter-e2e/mock-llm/responses'
import { resolveMockTurn, startMockLlmServer } from '../../adapter-e2e/mock-llm/server'
import { ADAPTER_E2E_DEFAULTS } from '../../adapter-e2e/scenarios'
import type { JsonObject, MockLlmServerHandle } from '../../adapter-e2e/types'
import { ADAPTER_E2E_CASES, collectCaseMockScenarios } from './cases'

const createReadBody = (): JsonObject => ({
  model: 'hook-smoke-mock,codex-read-once',
  input: [
    {
      role: 'user',
      content: ADAPTER_E2E_DEFAULTS.codex.prompt
    }
  ],
  tools: [
    {
      name: 'Read',
      parameters: {
        properties: {
          filePath: { type: 'string' }
        }
      }
    }
  ]
})

describe('mock llm server', () => {
  let server: MockLlmServerHandle | undefined
  const defaultScenarios = collectCaseMockScenarios(ADAPTER_E2E_CASES)

  afterEach(async () => {
    await server?.close()
    server = undefined
  })

  it('resolves a tool call before returning the final assistant message', () => {
    const toolTurn = resolveMockTurn(defaultScenarios, 'hook-smoke-mock,codex-read-once', createReadBody())
    expect(toolTurn.kind).toBe('tool')
    expect(toolTurn.kind === 'tool' ? toolTurn.tool.name : '').toBe('Read')

    const finalTurn = resolveMockTurn(defaultScenarios, 'hook-smoke-mock,codex-read-once', {
      ...createReadBody(),
      input: [
        {
          type: 'function_call_output',
          call_id: 'call_1',
          output: 'README contents'
        }
      ]
    })
    expect(finalTurn).toEqual({
      kind: 'message',
      text: 'E2E_CODEX'
    })
  })

  it('supports custom scenario registries for lightweight e2e authoring', async () => {
    server = await startMockLlmServer({
      scenarios: [
        createRuleBasedMockScenario({
          id: 'custom-flow',
          title: 'Custom title',
          finalOutput: 'CUSTOM_DONE',
          rules: [
            defineMockScenarioRule({
              id: 'title',
              when: whenTitleGeneration(),
              respond: messageTurn('Custom title')
            }),
            defineMockScenarioRule({
              id: 'final',
              when: whenToolResult(),
              respond: messageTurn('CUSTOM_DONE')
            }),
            defineMockScenarioRule({
              id: 'tool',
              when: whenRequestTextIncludes('Use a tool first'),
              respond: selectedToolTurn(messageTurn('CUSTOM_DONE'))
            }),
            defineMockScenarioRule({
              id: 'tool-fallback',
              when: whenToolsAvailable(),
              respond: selectedToolTurn(messageTurn('CUSTOM_DONE'))
            })
          ]
        })
      ]
    })

    const response = await fetch(`http://127.0.0.1:${server.port}/v1/responses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'hook-smoke-mock,custom-flow',
        input: [
          {
            role: 'user',
            content: 'Use a tool first'
          }
        ],
        tools: [
          {
            name: 'exec_command',
            parameters: {
              properties: {
                cmd: { type: 'string' }
              }
            }
          }
        ]
      })
    })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.output[0].type).toBe('function_call')
    expect(payload.output[0].name).toBe('exec_command')
  })

  it('returns a controlled error for unknown scenario models', async () => {
    server = await startMockLlmServer({
      scenarios: []
    })

    const response = await fetch(`http://127.0.0.1:${server.port}/v1/responses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'hook-smoke-mock,missing-case',
        input: [
          {
            role: 'user',
            content: 'reply'
          }
        ]
      })
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: 'unknown_model_scenario',
      model: 'hook-smoke-mock,missing-case'
    })
  })

  it('returns title text for title generation requests', () => {
    const turn = resolveMockTurn(
      defaultScenarios,
      'hook-smoke-mock-ccr,claude-read-once',
      {
        model: 'hook-smoke-mock-ccr,claude-read-once',
        input: [
          {
            role: 'user',
            content: 'Generate a title for this conversation'
          }
        ]
      }
    )

    expect(turn).toEqual({
      kind: 'message',
      text: 'Claude hook smoke'
    })
  })

  it('serializes apply_patch as a custom tool call', () => {
    expect(buildResponsesToolCall({
      name: 'apply_patch',
      callType: 'custom',
      args: {
        patch: '*** Begin Patch\n*** End Patch\n'
      }
    })).toMatchObject({
      type: 'custom_tool_call',
      name: 'apply_patch',
      input: '*** Begin Patch\n*** End Patch\n'
    })
  })
})
