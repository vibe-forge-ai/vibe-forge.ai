import process from 'node:process'

import type { Command } from 'commander'

import { formatListCommand, formatResumeCommand } from '#~/session-cache.js'

import { signalCliSession } from './session-control'

export function registerStopCommand(program: Command) {
  program
    .command('stop <sessionId>')
    .description('Stop a running CLI session')
    .addHelpText(
      'after',
      `
Examples:
  vf list --running
  vf stop <sessionId>
`
    )
    .action(async (sessionId: string) => {
      try {
        const result = await signalCliSession({
          cwd: process.cwd(),
          sessionId,
          signal: 'SIGTERM'
        })
        console.log(result.message)
        console.log(
          `Tips:\n  Check running sessions: ${formatListCommand({ running: true })}\n  Resume later: ${formatResumeCommand(sessionId)}`
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        process.exit(1)
      }
    })
}
