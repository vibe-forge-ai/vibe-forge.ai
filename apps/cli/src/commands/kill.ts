import type { Command } from 'commander'
import { getCache } from '@vibe-forge/core/utils/cache'
import process from 'node:process'
import type { TaskDetail } from '@vibe-forge/core'

export function registerKillCommand(program: Command) {
  program
    .command('kill <ctxId>')
    .description('Kill a running task (SIGKILL)')
    .action(async (ctxId: string) => {
      try {
        // @ts-ignore
        const detail = await getCache(process.cwd(), ctxId, undefined, 'detail') as TaskDetail | undefined
        if (!detail) {
          console.error(`Task ${ctxId} not found.`)
          process.exit(1)
        }

        if (detail.status !== 'running') {
          console.log(`Task ${ctxId} is not running (status: ${detail.status}).`)
          return
        }

        if (!detail.pid) {
          console.error(`Task ${ctxId} has no PID recorded.`)
          process.exit(1)
        }

        try {
          process.kill(detail.pid, 'SIGKILL')
          console.log(`Sent SIGKILL to process ${detail.pid}.`)
        } catch (e: any) {
          if (e.code === 'ESRCH') {
            console.error(`Process ${detail.pid} not found.`)
          } else {
            console.error(`Failed to kill process ${detail.pid}:`, e.message)
            process.exit(1)
          }
        }
      } catch (e: any) {
        console.error(`Error killing task:`, e.message)
        process.exit(1)
      }
    })
}
