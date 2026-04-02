import process from 'node:process'

import type { Command } from 'commander'

import { signalCliSession } from './session-control'

export function registerKillCommand(program: Command) {
  program
    .command('kill <sessionId>')
    .description('Force kill a running CLI session')
    .action(async (sessionId: string) => {
      try {
        const result = await signalCliSession({
          cwd: process.cwd(),
          sessionId,
          signal: 'SIGKILL'
        })
        console.log(result.message)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        process.exit(1)
      }
    })
}
