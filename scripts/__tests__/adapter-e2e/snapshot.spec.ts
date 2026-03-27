import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { repoRoot } from '../../adapter-e2e/runtime'
import { createAdapterE2ESnapshot } from '../../adapter-e2e/snapshot'
import type { AdapterE2EResult } from '../../adapter-e2e/types'

const createResult = (stderr: string): AdapterE2EResult => ({
  caseId: 'codex-direct-answer',
  adapter: 'codex',
  ctxId: 'hooks-smoke-codex-1',
  sessionId: '00000000-0000-0000-0000-000000000000',
  logPath: path.resolve(repoRoot, '.ai/logs/hooks-smoke-codex-1/00000000-0000-0000-0000-000000000000.log.md'),
  logContent: '',
  managedArtifacts: [],
  stdout: 'E2E_CODEX_DIRECT',
  stderr,
  exitCode: 0,
  transport: 'wrapper',
  mockTrace: []
})

describe('adapter e2e snapshot stderr projection', () => {
  it('filters codex featured-plugin sync html noise', () => {
    const snapshot = createAdapterE2ESnapshot(createResult([
      'WARN codex_core::models_manager::model_info: Unknown model codex-direct-answer is used. This will use fallback model metadata.',
      'WARN codex_core::plugins::manager: failed to warm featured plugin ids cache error=remote plugin sync request to https://chatgpt.com/backend-api/plugins/featured failed with status 403 Forbidden: <html>',
      '<head>',
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      '<body>',
      'width="41"',
      'height="41"',
      '>',
      '<path',
      'd="M0 0"',
      '/>'
    ].join('\n')))

    expect(snapshot.stderr).toEqual([
      'WARN codex_core::models_manager::model_info: Unknown model codex-direct-answer is used. This will use fallback model metadata.'
    ])
  })
})
