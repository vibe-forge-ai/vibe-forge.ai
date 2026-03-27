import { repoRoot } from '../runtime'
import type { JsonObject, MockModelScenario, MockScenarioTurn } from '../types'
import { getRequestText, hasToolResult, isTitleGenerationRequest } from './request'
import { pickToolCall } from './tooling'

const defaultResolveTurn = (
  scenario: MockModelScenario,
  body: JsonObject
): MockScenarioTurn => {
  if (isTitleGenerationRequest(body)) {
    return {
      kind: 'message',
      text: scenario.title
    }
  }

  if (hasToolResult(body)) {
    return {
      kind: 'message',
      text: scenario.finalOutput
    }
  }

  const tool = pickToolCall(body)
  if (tool != null) {
    return {
      kind: 'tool',
      tool
    }
  }

  return {
    kind: 'message',
    text: scenario.finalOutput
  }
}

export const resolveMockScenario = (
  scenarios: MockModelScenario[],
  model: string
) => {
  const normalized = model.trim()
  return scenarios.find((scenario) => (
    normalized.includes(scenario.id) ||
    (scenario.aliases ?? []).some(alias => normalized.includes(alias))
  ))
}

export const resolveMockTurn = (
  scenarios: MockModelScenario[],
  model: string,
  body: JsonObject
) => {
  const scenario = resolveMockScenario(scenarios, model)
  if (scenario == null) {
    throw new Error(`No mock model scenario registered for ${model}`)
  }

  if (scenario.resolveTurn != null) {
    return scenario.resolveTurn(
      {
        model,
        body,
        repoRoot
      },
      {
        getRequestText,
        hasToolResult,
        isTitleGenerationRequest,
        pickToolCall
      }
    )
  }

  return defaultResolveTurn(scenario, body)
}
