import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { countHookLogEvents, parseHookLogEntries } from '../../adapter-e2e/log'
import { repoRoot } from '../../adapter-e2e/runtime'
import { createAdapterE2ESnapshot } from '../../adapter-e2e/snapshot'
import type { AdapterE2EResult } from '../../adapter-e2e/types'

const fixtureLog = `
# [3/27/2026, 2:37:33 PM] __I__ [SessionStart] [plugin.logger]
\`\`\`json
{
  "adapter": "codex",
  "hookSource": "native",
  "canBlock": true
}
\`\`\`
# [3/27/2026, 2:37:33 PM] __I__ [PreToolUse] [plugin.logger] codex Bash
\`\`\`json
{
  "command": "sed -n '1,200p' README.md"
}
\`\`\`
# [3/27/2026, 2:37:33 PM] __I__ [PostToolUse] [plugin.logger] Bash
\`\`\`json
undefined
\`\`\`
\`\`\`text
> sed -n '1,200p' README.md

stdout: # Vibe Forge AI
\`\`\`
`.trim()

const yamlFixtureLog = `
# [4/6/2026, 10:38:25 PM] __I__ [TaskStart] [plugin.logger]
\`\`\`yaml
adapter: codex
options:
  env:
    redacted: true
\`\`\`
# [4/6/2026, 10:38:37 PM] __I__ [UserPromptSubmit] [plugin.logger]
\`\`\`yaml
adapter: codex
hookSource: native
canBlock: true
prompt: "Use the Read tool exactly once on README.md, then reply with exactly E2E_CODEX and nothing else."
\`\`\`
`.trim()

const createResult = (): AdapterE2EResult => ({
  caseId: 'codex-read-once',
  adapter: 'codex',
  ctxId: 'hooks-smoke-codex-1',
  sessionId: '00000000-0000-0000-0000-000000000000',
  logPath: path.resolve(repoRoot, '.ai/logs/hooks-smoke-codex-1/00000000-0000-0000-0000-000000000000.log.md'),
  logContent: fixtureLog,
  managedArtifacts: [],
  stdout: 'E2E_CODEX',
  stderr: '',
  exitCode: 0,
  transport: 'wrapper',
  mockTrace: []
})

describe('adapter e2e hook log parsing', () => {
  it('parses tool hook entries with header text and invalid json payloads', () => {
    const entries = parseHookLogEntries(fixtureLog)
    const counts = countHookLogEvents(entries)

    expect(entries.map(entry => entry.eventName)).toEqual([
      'SessionStart',
      'PreToolUse',
      'PostToolUse'
    ])
    expect(entries[1]?.headerText).toBe('codex Bash')
    expect(entries[2]?.headerText).toBe('Bash')
    expect(entries[2]?.textBlock).toContain('stdout: # Vibe Forge AI')
    expect(counts.get('PreToolUse')).toBe(1)
    expect(counts.get('PostToolUse')).toBe(1)
  })

  it('keeps tool hook entries visible in the stable snapshot projection', () => {
    const snapshot = createAdapterE2ESnapshot(createResult())

    expect(snapshot.log.entries).toEqual([
      {
        event: 'SessionStart',
        adapter: 'codex',
        hookSource: 'native',
        canBlock: true
      },
      {
        event: 'PreToolUse',
        header: 'codex Bash',
        toolName: 'Bash',
        detail: "sed -n '1,200p' README.md"
      },
      {
        event: 'PostToolUse',
        header: 'Bash',
        toolName: 'Bash',
        detail: "> sed -n '1,200p' README.md"
      }
    ])
  })

  it('parses yaml hook payloads used by the logger plugin', () => {
    const entries = parseHookLogEntries(yamlFixtureLog)
    const counts = countHookLogEvents(entries)

    expect(counts.get('TaskStart')).toBe(1)
    expect(counts.get('UserPromptSubmit')).toBe(1)
    expect(entries[0]?.payload).toEqual({
      adapter: 'codex',
      options: {
        env: {
          redacted: true
        }
      }
    })
    expect(entries[1]?.payload).toEqual({
      adapter: 'codex',
      hookSource: 'native',
      canBlock: true,
      prompt: 'Use the Read tool exactly once on README.md, then reply with exactly E2E_CODEX and nothing else.'
    })
  })
})
