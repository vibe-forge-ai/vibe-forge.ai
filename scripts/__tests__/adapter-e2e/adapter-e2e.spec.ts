import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADAPTER_E2E_CASES,
  resolveSelectedAdapterE2ECases
} from './cases'
import { createAdapterE2EHarness } from '../../adapter-e2e/harness'
import { expectAdapterE2EResultToMatchSnapshot } from './assertions'

const shouldRunE2E = process.env.VF_RUN_ADAPTER_E2E === '1'
const describeE2E = shouldRunE2E ? describe.sequential : describe.skip
const selectedCases = resolveSelectedAdapterE2ECases(
  process.env.VF_ADAPTER_E2E_SELECTION ?? 'all',
  ADAPTER_E2E_CASES
)

describeE2E('adapter e2e harness', () => {
  let harness: Awaited<ReturnType<typeof createAdapterE2EHarness>> | undefined

  beforeAll(async () => {
    harness = await createAdapterE2EHarness({
      cases: selectedCases,
      passthroughStdIO: process.env.VF_E2E_VERBOSE === '1',
      printSummary: false
    })
  }, 300_000)

  afterAll(async () => {
    await harness?.close()
  }, 120_000)

  for (const testCase of selectedCases) {
    it(`${testCase.id} completes a full offline CLI flow`, async () => {
      const result = await harness?.runCase(testCase)
      expect(result).toBeDefined()
      await expectAdapterE2EResultToMatchSnapshot(testCase, result!)
    }, 300_000)
  }
})
