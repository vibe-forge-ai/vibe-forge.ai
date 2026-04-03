import process from 'node:process'

import { runProcess } from './adapter-e2e/runtime'

interface MessageActionsVerificationStep {
  label: string
  command: string
  args: string[]
}

export interface MessageActionsVerifyInput {
  quiet: boolean
}

const messageActionVerificationSteps: MessageActionsVerificationStep[] = [
  {
    label: 'Run ESLint',
    command: 'pnpm',
    args: ['exec', 'eslint', '.']
  },
  {
    label: 'Run dprint format check',
    command: 'pnpm',
    args: ['exec', 'dprint', 'check']
  },
  {
    label: 'Run typecheck',
    command: 'pnpm',
    args: ['typecheck']
  },
  {
    label: 'Run targeted session/message regression tests',
    command: 'pnpm',
    args: [
      'exec',
      'vitest',
      'run',
      '--workspace',
      'vitest.workspace.ts',
      'apps/server/__tests__/db/index.spec.ts',
      'apps/server/__tests__/db/schema.spec.ts',
      'apps/server/__tests__/services/session-history.spec.ts',
      'apps/server/__tests__/services/session-interaction.spec.ts',
      'apps/server/__tests__/services/session-start.spec.ts',
      'apps/server/__tests__/services/session.spec.ts',
      'apps/server/__tests__/websocket/server.spec.ts'
    ]
  }
]

const browserChecklist = [
  '[message-actions] Browser validation checklist',
  '1. Start the app with `pnpm start` and ensure `http://localhost:5173/ui` + `http://localhost:8787/api/sessions` are reachable.',
  '2. In real Chrome, verify inline edit replaces the original bubble and the confirm button label is `发送`.',
  '3. While one message is editing, verify a second edit attempt shows the warning and does not open another editor.',
  '4. While editing, verify the bottom sender is hidden and restored after cancel.',
  '5. Verify assistant messages do not expose fork, and `复制原文` copies raw markdown/text.',
  '6. Verify edit/fork still produce a branched continuation with a fresh assistant reply.'
].join('\n')

export const runMessageActionsVerify = async (input: MessageActionsVerifyInput) => {
  for (const step of messageActionVerificationSteps) {
    process.stdout.write(`\n[message-actions] ${step.label}\n`)

    const result = await runProcess({
      command: step.command,
      args: step.args,
      env: process.env,
      passthroughStdIO: !input.quiet
    })

    if (result.code !== 0) {
      process.exitCode = result.code
      return
    }
  }

  process.stdout.write(`\n${browserChecklist}\n`)
}
