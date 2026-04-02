import process from 'node:process'

import type { Command } from 'commander'

import { resolveCliSession, writeCliSessionRecord } from '#~/session-cache.js'

export function registerStopCommand(program: Command) {
  program
    .command('stop <sessionId>')
    .description('Stop a running CLI session')
    .action(async (sessionId: string) => {
      try {
        const record = await resolveCliSession(process.cwd(), sessionId)
        const detail = record.detail
        if (detail == null) {
          console.error(`Session ${sessionId} has no task metadata.`)
          process.exit(1)
        }

        if (detail.status !== 'running') {
          console.log(`Session ${detail.sessionId} is not running (status: ${detail.status}).`)
          return
        }

        if (detail.pid == null) {
          console.error(`Session ${detail.sessionId} has no PID recorded.`)
          process.exit(1)
        }

        try {
          process.kill(detail.pid, 'SIGTERM')
          await writeCliSessionRecord(process.cwd(), detail.ctxId, detail.sessionId, {
            ...record,
            detail: {
              ...detail,
              status: 'stopped',
              endTime: Date.now()
            }
          })
          console.log(`Sent SIGTERM to process ${detail.pid} for session ${detail.sessionId}.`)
        } catch (error: any) {
          if (error.code === 'ESRCH') {
            console.error(`Process ${detail.pid} not found.`)
            return
          }
          console.error(`Failed to stop process ${detail.pid}: ${error.message}`)
          process.exit(1)
        }
      } catch (error: any) {
        console.error(error.message)
        process.exit(1)
      }
    })
}
