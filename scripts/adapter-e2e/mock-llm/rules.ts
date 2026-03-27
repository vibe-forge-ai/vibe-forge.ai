import type {
  JsonObject,
  MockModelScenario,
  MockScenarioContext,
  MockScenarioHelpers,
  MockScenarioRule,
  MockScenarioTurn,
  MockToolCall
} from '../types'

type ScenarioPredicate = (
  context: MockScenarioContext,
  helpers: MockScenarioHelpers
) => boolean

type ScenarioResponder = (
  context: MockScenarioContext,
  helpers: MockScenarioHelpers
) => MockScenarioTurn

const resolveTurn = (
  turn: MockScenarioTurn | ScenarioResponder,
  context: MockScenarioContext,
  helpers: MockScenarioHelpers
) => {
  if (typeof turn === 'function') {
    return turn(context, helpers)
  }
  return turn
}

export const defineMockScenarioRule = (rule: MockScenarioRule) => rule

export const messageTurn = (text: string): MockScenarioTurn => ({
  kind: 'message',
  text
})

export const toolTurn = (
  name: string,
  args: MockToolCall['args'] = {}
): MockScenarioTurn => ({
  kind: 'tool',
  tool: {
    name,
    args
  }
})

export const selectedToolTurn = (
  fallback?: MockScenarioTurn
) =>
(
  context: MockScenarioContext,
  helpers: MockScenarioHelpers
): MockScenarioTurn => {
  const tool = helpers.pickToolCall(context.body)
  if (tool != null) {
    return {
      kind: 'tool',
      tool
    }
  }
  return fallback ?? messageTurn('')
}

export const whenTitleGeneration = (): ScenarioPredicate =>
(
  context,
  helpers
) => helpers.isTitleGenerationRequest(context.body)

export const whenToolResult = (): ScenarioPredicate =>
(
  context,
  helpers
) => helpers.hasToolResult(context.body)

export const whenRequestTextIncludes = (...needles: string[]): ScenarioPredicate =>
(
  context,
  helpers
) => {
  const requestText = helpers.getRequestText(context.body)
  return needles.every(needle => requestText.includes(needle))
}

export const whenToolsAvailable = (): ScenarioPredicate =>
(
  context,
  helpers
) => helpers.pickToolCall(context.body) != null

export const whenAlways = (): ScenarioPredicate => () => true

export const andPredicates = (...predicates: ScenarioPredicate[]): ScenarioPredicate =>
(
  context,
  helpers
) => predicates.every(predicate => predicate(context, helpers))

export const createRuleBasedMockScenario = (input: {
  id: string
  title: string
  aliases?: string[]
  finalOutput: string
  rules: MockScenarioRule[]
  fallback?: MockScenarioTurn
}): MockModelScenario => ({
  id: input.id,
  title: input.title,
  aliases: input.aliases,
  finalOutput: input.finalOutput,
  resolveTurn: (context, helpers) => {
    for (const rule of input.rules) {
      if (rule.when(context, helpers)) {
        return resolveTurn(rule.respond, context, helpers)
      }
    }

    return input.fallback ?? messageTurn(input.finalOutput)
  }
})

export const matchRequest = (
  body: JsonObject,
  predicates: ScenarioPredicate[],
  helpers: MockScenarioHelpers,
  model: string,
  repoRoot: string
) => predicates.every(predicate => predicate({ body, model, repoRoot }, helpers))
