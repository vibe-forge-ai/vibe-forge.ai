import process from 'node:process'

import type { TaskDetail } from '@vibe-forge/types'
import type { Command } from 'commander'

import { formatResumeCommand, listCliSessions } from '#~/session-cache.js'

interface ListOptions {
  all?: boolean
  json?: boolean
  limit?: string
  running?: boolean
  status?: string[]
}

const TASK_STATUSES = ['pending', 'running', 'completed', 'failed', 'stopped'] as const
type TaskStatus = (typeof TASK_STATUSES)[number]

const isTaskStatus = (value: string): value is TaskStatus => (TASK_STATUSES as readonly string[]).includes(value)

const truncate = (value: string | undefined, maxLength: number) => {
  if (value == null || value === '') return ''
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
}

const getUpdatedAt = (params: {
  detailStartTime?: number
  detailEndTime?: number
  resumeUpdatedAt?: number
}) => (
  params.resumeUpdatedAt ??
    params.detailEndTime ??
    params.detailStartTime ??
    0
)

export function registerListCommand(program: Command) {
  program
    .command('list')
    .alias('ls')
    .description('List cached CLI sessions')
    .option('--all', 'Show all sessions', false)
    .option('--json', 'Print JSON output', false)
    .option('--limit <count>', 'Limit displayed sessions')
    .option('--running', 'Show only running sessions', false)
    .option('--status <status...>', `Filter by status (${TASK_STATUSES.join(', ')})`)
    .action(async (opts: ListOptions) => {
      const records = await listCliSessions(process.cwd())
      if (records.length === 0) {
        console.log('No cached sessions found.')
        return
      }

      const requestedStatuses = new Set<TaskDetail['status']>()
      if (opts.running) requestedStatuses.add('running')
      for (const status of opts.status ?? []) {
        if (!isTaskStatus(status)) {
          throw new Error(`Unsupported status "${status}". Expected one of: ${TASK_STATUSES.join(', ')}`)
        }
        requestedStatuses.add(status)
      }

      const limit = opts.all
        ? records.length
        : Math.max(1, Number.parseInt(opts.limit ?? '20', 10) || 20)
      const rows = records
        .filter((record) => (
          requestedStatuses.size === 0 ||
          (record.detail?.status != null && requestedStatuses.has(record.detail.status))
        ))
        .slice(0, limit)
        .map((record) => {
          const sessionId = record.resume?.sessionId ?? record.detail?.sessionId ?? ''
          const ctxId = record.resume?.ctxId ?? record.detail?.ctxId ?? ''

          return {
            sessionId,
            ctxId,
            status: record.detail?.status ?? 'unknown',
            adapter: record.detail?.adapter ?? record.resume?.taskOptions.adapter ?? '',
            model: record.detail?.model ?? record.resume?.adapterOptions.model ?? '',
            updatedAt: getUpdatedAt({
              detailStartTime: record.detail?.startTime,
              detailEndTime: record.detail?.endTime,
              resumeUpdatedAt: record.resume?.updatedAt
            }),
            pid: record.detail?.pid,
            description: record.detail?.description ?? record.resume?.description ?? '',
            resumeCommand: sessionId === '' ? '' : formatResumeCommand(sessionId)
          }
        })

      if (rows.length === 0) {
        console.log('No cached sessions matched the requested filters.')
        return
      }

      if (opts.json) {
        console.log(JSON.stringify(rows, null, 2))
        return
      }

      console.table(rows.map((row) => ({
        Session: row.sessionId,
        Status: row.status,
        Adapter: row.adapter,
        Model: row.model,
        Updated: row.updatedAt === 0 ? '' : new Date(row.updatedAt).toLocaleString(),
        PID: row.pid ?? '',
        Description: truncate(row.description, 60),
        Resume: row.resumeCommand
      })))
    })
}
