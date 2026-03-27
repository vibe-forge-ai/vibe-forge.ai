import {
  ADAPTER_E2E_CASES,
  collectCaseMockScenarios,
  resolveAdapterE2ECase,
  resolveSelectedAdapterE2ECases
} from '../__tests__/adapter-e2e/cases'
import { startMockLlmServer } from './mock-llm/server'
import { runOpenCode, runWrappedAdapter } from './runners'
import type {
  AdapterE2ECase,
  AdapterE2EHarnessOptions,
  AdapterE2EResult,
  MockLlmTraceEntry,
  ResolvedAdapterE2ECase
} from './types'

const printScenarioResult = (result: AdapterE2EResult) => {
  const suffix = result.transport === 'upstream-fallback' ? ':upstream' : ''
  console.log(`\n[e2e:${result.caseId}:${result.adapter}${suffix}] ok`)
  console.log(`ctxId=${result.ctxId}`)
  console.log(`sessionId=${result.sessionId}`)
  console.log(`log=${result.logPath}`)
}

export const createAdapterE2EHarness = async (
  options: AdapterE2EHarnessOptions = {}
) => {
  const cases = options.cases ?? ADAPTER_E2E_CASES
  const mockServer = await startMockLlmServer({
    ...options.mockServerOptions,
    scenarios: [
      ...(options.mockServerOptions?.scenarios ?? []),
      ...collectCaseMockScenarios(cases)
    ]
  })

  const runCase = async (testCase: AdapterE2ECase) => {
    const resolvedCase = resolveAdapterE2ECase(testCase)
    const traceStartIndex = mockServer.getTrace().length
    let result: AdapterE2EResult
    if (resolvedCase.adapter === 'codex' || resolvedCase.adapter === 'claude-code') {
      result = await runWrappedAdapter(resolvedCase, mockServer.port, options)
    } else if (resolvedCase.adapter === 'opencode') {
      result = await runOpenCode(resolvedCase, mockServer.port, options)
    } else {
      throw new Error(`Unsupported adapter e2e target: ${resolvedCase.adapter}`)
    }

    return {
      ...result,
      mockTrace: collectCaseMockTrace(
        mockServer.getTrace(),
        traceStartIndex,
        resolvedCase
      )
    }
  }

  return {
    mockServerPort: mockServer.port,
    cases,
    runCase,
    async runSuite(selection: string | undefined = 'all') {
      const results: AdapterE2EResult[] = []
      for (const testCase of resolveSelectedAdapterE2ECases(selection, cases)) {
        results.push(await runCase(testCase))
      }
      return results
    },
    async close() {
      await mockServer.close()
    }
  }
}

const matchesResolvedCaseModel = (
  entry: MockLlmTraceEntry,
  testCase: ResolvedAdapterE2ECase
) => {
  const candidates = [testCase.id, testCase.model].filter(Boolean)
  return candidates.some(candidate => (
    entry.model === candidate ||
    entry.model.includes(candidate) ||
    candidate.includes(entry.model)
  ))
}

export const collectCaseMockTrace = (
  trace: MockLlmTraceEntry[],
  traceStartIndex: number,
  testCase: ResolvedAdapterE2ECase
) => {
  const nextTrace = trace.slice(traceStartIndex)
  const matchedTrace = nextTrace.filter(entry => matchesResolvedCaseModel(entry, testCase))
  return matchedTrace.length > 0 ? matchedTrace : nextTrace
}

export const runAdapterE2ESuite = async (
  requested: string | undefined = 'all',
  options: AdapterE2EHarnessOptions = {}
) => {
  const harness = await createAdapterE2EHarness(options)
  try {
    const results = await harness.runSuite(requested)
    if (options.printSummary ?? true) {
      for (const result of results) {
        printScenarioResult(result)
      }
    }
    return results
  } finally {
    await harness.close()
  }
}
