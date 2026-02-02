import type { TaskDetail } from '@vibe-forge/core'
import { getCache } from '@vibe-forge/core/utils/cache'
import type { Command } from 'commander'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

export function registerListCommand(program: Command) {
  program
    .command('list')
    .alias('ls')
    .description('List historical tasks')
    .action(async () => {
      const cacheRoot = path.resolve(process.cwd(), '.ai/caches')
      try {
        await fs.access(cacheRoot)
      } catch {
        console.log('No tasks found.')
        return
      }

      const entries = await fs.readdir(cacheRoot, { withFileTypes: true })
      const tasks: TaskDetail[] = []

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const ctxId = entry.name
          try {
            // @ts-ignore
            const detail = await getCache(process.cwd(), ctxId, undefined, 'detail') as TaskDetail | undefined
            if (detail) {
              tasks.push(detail)
            }
          } catch {
            // ignore
          }
        }
      }

      if (tasks.length === 0) {
        console.log('No tasks found.')
        return
      }

      // Sort by startTime desc
      tasks.sort((a, b) => b.startTime - a.startTime)

      console.table(tasks.map(t => ({
        ID: t.ctxId,
        Status: t.status,
        Adapter: t.adapter,
        Description: t.description
          ? (t.description.length > 50 ? `${t.description.slice(0, 47)}...` : t.description)
          : '',
        Start: new Date(t.startTime).toLocaleString(),
        PID: t.pid
      })))
    })
}
