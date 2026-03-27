import path from 'node:path'

import { expect } from 'vitest'

import { countHookLogEvents, parseHookLogEntries } from '../../adapter-e2e/log'
import { repoRoot } from '../../adapter-e2e/runtime'
import { serializeAdapterE2ESnapshot } from '../../adapter-e2e/snapshot'
import type {
  AdapterE2ECase,
  AdapterE2ECaseExpectations,
  AdapterE2EResult
} from '../../adapter-e2e/types'

export const resolveAdapterE2ESnapshotPath = (testCase: AdapterE2ECase) => (
  path.resolve(
    repoRoot,
    'scripts/__tests__/adapter-e2e/__snapshots__',
    `${testCase.id}.snapshot.json`
  )
)

const expectOutput = (
  expectations: AdapterE2ECaseExpectations,
  result: AdapterE2EResult
) => {
  for (const needle of expectations.outputContains ?? []) {
    expect(result.stdout).toContain(needle)
  }
}

const expectHooks = (
  expectations: AdapterE2ECaseExpectations,
  result: AdapterE2EResult
) => {
  const counts = countHookLogEvents(parseHookLogEntries(result.logContent))

  for (const rule of expectations.hooks ?? []) {
    const count = counts.get(rule.event) ?? 0
    if (rule.count != null) {
      expect(count, `hook ${rule.event} count`).toBe(rule.count)
    }
    if (rule.minCount != null) {
      expect(count, `hook ${rule.event} minCount`).toBeGreaterThanOrEqual(rule.minCount)
    }
    if (rule.maxCount != null) {
      expect(count, `hook ${rule.event} maxCount`).toBeLessThanOrEqual(rule.maxCount)
    }
  }
}

const expectMockTrace = (
  expectations: AdapterE2ECaseExpectations,
  result: AdapterE2EResult
) => {
  const mockTrace = expectations.mockTrace
  if (mockTrace == null) return

  if (mockTrace.minRequests != null) {
    expect(result.mockTrace.length).toBeGreaterThanOrEqual(mockTrace.minRequests)
  }

  const toolResponses = result.mockTrace.flatMap(entry => (
    entry.response.kind === 'tool'
      ? [entry.response.tool.name]
      : []
  ))

  if (mockTrace.maxToolCalls != null) {
    expect(toolResponses.length).toBeLessThanOrEqual(mockTrace.maxToolCalls)
  }

  for (const toolName of mockTrace.requiredToolNames ?? []) {
    expect(toolResponses).toContain(toolName)
  }

  if (mockTrace.finalResponseText != null) {
    expect(result.mockTrace.some(entry => (
      entry.response.kind === 'message'
      && entry.response.text === mockTrace.finalResponseText
    ))).toBe(true)
  }
}

export const expectAdapterE2EResultToMatchSnapshot = (
  testCase: AdapterE2ECase,
  result: AdapterE2EResult
): Promise<void> => {
  expect(result.exitCode).toBe(0)
  expect(testCase.allowedTransports ?? ['wrapper']).toContain(result.transport)
  expectOutput(testCase.expectations ?? {}, result)
  expectHooks(testCase.expectations ?? {}, result)
  expectMockTrace(testCase.expectations ?? {}, result)
  return expect(serializeAdapterE2ESnapshot(result)).toMatchFileSnapshot(
    resolveAdapterE2ESnapshotPath(testCase)
  )
}
