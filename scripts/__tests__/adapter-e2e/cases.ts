import {
  ADAPTER_E2E_DEFAULTS,
  ADAPTER_E2E_TARGETS
} from '../../adapter-e2e/scenarios'
import { cliPath } from '../../adapter-e2e/runtime'
import {
  andPredicates,
  createRuleBasedMockScenario,
  defineMockScenarioRule,
  messageTurn,
  selectedToolTurn,
  whenRequestTextIncludes,
  whenTitleGeneration,
  whenToolResult,
  whenToolsAvailable
} from '../../adapter-e2e/mock-llm/rules'
import type {
  AdapterE2ECase,
  AdapterE2ECaseExpectations,
  AdapterE2ETarget,
  ResolvedAdapterE2ECase,
  MockModelScenario
} from '../../adapter-e2e/types'

export const defineAdapterE2ECase = (testCase: AdapterE2ECase) => testCase

const TOOL_CASES: Record<AdapterE2ETarget, {
  prompt: string
  output: string
  toolName: string
  title: string
}> = {
  codex: {
    prompt: 'Use the Read tool exactly once on README.md, then reply with exactly E2E_CODEX and nothing else.',
    output: 'E2E_CODEX',
    toolName: 'exec_command',
    title: 'Codex hook smoke'
  },
  'claude-code': {
    prompt: 'Use the Read tool exactly once on README.md, then reply with exactly E2E_CLAUDE and nothing else.',
    output: 'E2E_CLAUDE',
    toolName: 'Read',
    title: 'Claude hook smoke'
  },
  opencode: {
    prompt: 'Use the read tool exactly once on README.md, then reply with exactly E2E_OPENCODE and nothing else.',
    output: 'E2E_OPENCODE',
    toolName: 'read',
    title: 'OpenCode hook smoke'
  }
}

const NO_TOOL_CASES: Record<AdapterE2ETarget, {
  prompt: string
  output: string
  title: string
}> = {
  codex: {
    prompt: 'Do not use any tool. Reply with exactly E2E_CODEX_DIRECT and nothing else.',
    output: 'E2E_CODEX_DIRECT',
    title: 'Codex direct answer smoke'
  },
  'claude-code': {
    prompt: 'Do not use any tool. Reply with exactly E2E_CLAUDE_DIRECT and nothing else.',
    output: 'E2E_CLAUDE_DIRECT',
    title: 'Claude direct answer smoke'
  },
  opencode: {
    prompt: 'Do not use any tool. Reply with exactly E2E_OPENCODE_DIRECT and nothing else.',
    output: 'E2E_OPENCODE_DIRECT',
    title: 'OpenCode direct answer smoke'
  }
}

const resolveModelProvider = (adapter: AdapterE2ETarget) => (
  (ADAPTER_E2E_DEFAULTS[adapter].model.split(',')[0] ?? ADAPTER_E2E_DEFAULTS[adapter].model).trim()
)

const createCaseModel = (adapter: AdapterE2ETarget, caseId: string) => (
  `${resolveModelProvider(adapter)},${caseId}`
)

const createToolCaseMockScenario = (
  scenarioId: string,
  title: string,
  finalOutput: string,
  requestNeedles: string[]
): MockModelScenario => createRuleBasedMockScenario({
  id: scenarioId,
  title,
  finalOutput,
  rules: [
    defineMockScenarioRule({
      id: 'title-generation',
      when: whenTitleGeneration(),
      respond: messageTurn(title)
    }),
    defineMockScenarioRule({
      id: 'tool-result',
      when: whenToolResult(),
      respond: messageTurn(finalOutput)
    }),
    defineMockScenarioRule({
      id: 'tool-call',
      when: andPredicates(
        whenToolsAvailable(),
        whenRequestTextIncludes(...requestNeedles)
      ),
      respond: selectedToolTurn(messageTurn(finalOutput))
    })
  ],
  fallback: messageTurn(finalOutput)
})

const createNoToolCaseMockScenario = (
  scenarioId: string,
  title: string,
  finalOutput: string
): MockModelScenario => createRuleBasedMockScenario({
  id: scenarioId,
  title,
  finalOutput,
  rules: [
    defineMockScenarioRule({
      id: 'title-generation',
      when: whenTitleGeneration(),
      respond: messageTurn(title)
    })
  ],
  fallback: messageTurn(finalOutput)
})

const createCommonExpectations = (
  finalOutput: string
): AdapterE2ECaseExpectations => ({
  outputContains: [finalOutput],
  hooks: [
    { event: 'GenerateSystemPrompt', minCount: 1 },
    { event: 'TaskStart', minCount: 1 },
    { event: 'SessionStart', minCount: 1 },
    { event: 'UserPromptSubmit', minCount: 1 },
    { event: 'Stop', minCount: 1 }
  ]
})

const createToolCaseExpectations = (
  finalOutput: string,
  toolName: string
): AdapterE2ECaseExpectations => {
  const base = createCommonExpectations(finalOutput)
  return {
    ...base,
    hooks: [
      ...(base.hooks ?? []),
      { event: 'PreToolUse', count: 1 },
      { event: 'PostToolUse', count: 1 }
    ],
    mockTrace: {
      minRequests: 2,
      requiredToolNames: [toolName],
      maxToolCalls: 1,
      finalResponseText: finalOutput
    }
  }
}

const createNoToolCaseExpectations = (
  finalOutput: string
): AdapterE2ECaseExpectations => {
  const base = createCommonExpectations(finalOutput)
  return {
    ...base,
    hooks: [
      ...(base.hooks ?? []),
      { event: 'PreToolUse', maxCount: 0 },
      { event: 'PostToolUse', maxCount: 0 }
    ],
    mockTrace: {
      minRequests: 1,
      maxToolCalls: 0,
      finalResponseText: finalOutput
    }
  }
}

const toolCase = (
  adapter: AdapterE2ETarget,
  id: string
): AdapterE2ECase => {
  const config = TOOL_CASES[adapter]
  return defineAdapterE2ECase({
    id,
    title: config.title,
    adapter,
    model: createCaseModel(adapter, id),
    prompt: config.prompt,
    allowedTransports: adapter === 'opencode'
      ? ['wrapper', 'upstream-fallback']
      : ['wrapper'],
    mockScenarios: [
      createToolCaseMockScenario(
        id,
        config.title,
        config.output,
        ['README.md', config.output]
      )
    ],
    expectations: createToolCaseExpectations(config.output, config.toolName)
  })
}

const directAnswerCase = (
  adapter: AdapterE2ETarget,
  id: string
): AdapterE2ECase => {
  const config = NO_TOOL_CASES[adapter]
  return defineAdapterE2ECase({
    id,
    title: config.title,
    adapter,
    model: createCaseModel(adapter, id),
    prompt: config.prompt,
    allowedTransports: adapter === 'opencode'
      ? ['wrapper', 'upstream-fallback']
      : ['wrapper'],
    mockScenarios: [
      createNoToolCaseMockScenario(
        id,
        config.title,
        config.output
      )
    ],
    expectations: createNoToolCaseExpectations(config.output)
  })
}

export const ADAPTER_E2E_CASES: AdapterE2ECase[] = [
  toolCase('codex', 'codex-read-once'),
  toolCase('claude-code', 'claude-read-once'),
  toolCase('opencode', 'opencode-read-once'),
  directAnswerCase('codex', 'codex-direct-answer'),
  directAnswerCase('claude-code', 'claude-direct-answer'),
  directAnswerCase('opencode', 'opencode-direct-answer')
]

const buildAdapterArgs = (
  adapter: AdapterE2ETarget,
  model: string,
  prompt: string,
  sessionId: string,
  extraArgs: string[]
) => {
  if (adapter === 'codex') {
    return [
      cliPath,
      '--adapter', 'codex',
      '--model', model,
      '--print',
      '--no-inject-default-system-prompt',
      '--permission-mode', 'bypassPermissions',
      '--exclude-mcp-server', 'ChromeDevtools',
      '--session-id', sessionId,
      ...extraArgs,
      prompt
    ]
  }

  if (adapter === 'claude-code') {
    return [
      cliPath,
      '--adapter', 'claude-code',
      '--model', model,
      '--print',
      '--no-inject-default-system-prompt',
      '--exclude-mcp-server', 'ChromeDevtools',
      '--include-tool', 'Read',
      '--permission-mode', 'bypassPermissions',
      '--session-id', sessionId,
      ...extraArgs,
      prompt
    ]
  }

  return [
    cliPath,
    '--adapter', 'opencode',
    '--model', model,
    '--print',
    '--no-inject-default-system-prompt',
    '--exclude-mcp-server', 'ChromeDevtools',
    '--session-id', sessionId,
    ...extraArgs,
    prompt
  ]
}

export const resolveAdapterE2ECase = (
  testCase: AdapterE2ECase
): ResolvedAdapterE2ECase => {
  const base = ADAPTER_E2E_DEFAULTS[testCase.adapter]
  const model = testCase.model ?? base.model
  const prompt = testCase.prompt ?? base.prompt
  const extraArgs = testCase.extraArgs ?? []

  return {
    id: testCase.id,
    title: testCase.title,
    adapter: testCase.adapter,
    model,
    prompt,
    allowedTransports: testCase.allowedTransports ?? ['wrapper'],
    args: (sessionId) => buildAdapterArgs(
      testCase.adapter,
      model,
      prompt,
      sessionId,
      extraArgs
    ),
    mockScenarios: testCase.mockScenarios ?? [],
    expectations: testCase.expectations ?? {}
  }
}

export const collectCaseMockScenarios = (cases: AdapterE2ECase[]) => {
  const scenarios = new Map<string, MockModelScenario>()
  for (const testCase of cases) {
    for (const scenario of testCase.mockScenarios ?? []) {
      scenarios.set(scenario.id, scenario)
    }
  }
  return Array.from(scenarios.values())
}

const isAdapterTarget = (value: string): value is AdapterE2ETarget => (
  ADAPTER_E2E_TARGETS.includes(value as AdapterE2ETarget)
)

export const parseAdapterE2ESelection = (
  value: string | undefined,
  cases: AdapterE2ECase[] = ADAPTER_E2E_CASES
) => {
  const normalized = value?.trim() ?? 'all'
  if (normalized === 'all') return normalized
  if (isAdapterTarget(normalized)) return normalized
  if (cases.some(testCase => testCase.id === normalized)) return normalized
  throw new Error(`Unsupported adapter e2e selection: ${normalized}`)
}

export const resolveSelectedAdapterE2ECases = (
  selection: string | undefined,
  cases: AdapterE2ECase[] = ADAPTER_E2E_CASES
) => {
  const normalized = parseAdapterE2ESelection(selection, cases)
  if (normalized === 'all') return [...cases]
  if (isAdapterTarget(normalized)) {
    return cases.filter(testCase => testCase.adapter === normalized)
  }
  const matchedCase = cases.find(testCase => testCase.id === normalized)
  if (matchedCase == null) {
    throw new Error(`Adapter e2e case not found: ${normalized}`)
  }
  return [matchedCase]
}
