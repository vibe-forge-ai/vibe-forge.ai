import process from 'node:process'

import type { TaskDetail } from '@vibe-forge/types'
import { Option } from 'commander'
import type { Command } from 'commander'

import {
  formatKillCommand,
  formatListCommand,
  formatResumeCommand,
  formatStopCommand,
  listCliSessions,
  resolveCliSessionAdapter,
  resolveCliSessionCtxId,
  resolveCliSessionDescription,
  resolveCliSessionId,
  resolveCliSessionModel,
  resolveCliSessionUpdatedAt
} from '#~/session-cache.js'

interface ListOptions {
  all?: boolean
  json?: boolean
  limit?: string
  running?: boolean
  status?: string[]
  verbose?: boolean
  view?: ListView
}

interface ListRow {
  sessionId: string
  ctxId: string
  status: TaskDetail['status'] | 'unknown'
  adapter: string
  model: string
  updatedAt: number
  pid?: number
  description: string
  resumeCommand: string
  stopCommand: string
  killCommand: string
}

const TASK_STATUSES = ['pending', 'running', 'completed', 'failed', 'stopped'] as const
const LIST_VIEWS = ['compact', 'default', 'full'] as const

type TaskStatus = (typeof TASK_STATUSES)[number]
type ListView = (typeof LIST_VIEWS)[number]

const isTaskStatus = (value: string): value is TaskStatus => (TASK_STATUSES as readonly string[]).includes(value)

const truncate = (value: string | undefined, maxLength: number) => {
  if (value == null || value === '') return ''
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
}

const formatUpdatedAt = (updatedAt: number) => updatedAt === 0 ? '' : new Date(updatedAt).toLocaleString()

const resolveListView = (view: ListView | undefined, verbose: boolean | undefined): ListView =>
  verbose ? 'full' : (view ?? 'compact')

const buildListRows = (records: Awaited<ReturnType<typeof listCliSessions>>) => (
  records.map((record) => {
    const sessionId = resolveCliSessionId(record)
    const status = record.detail?.status ?? 'unknown'

    return {
      sessionId,
      ctxId: resolveCliSessionCtxId(record),
      status,
      adapter: resolveCliSessionAdapter(record),
      model: resolveCliSessionModel(record),
      updatedAt: resolveCliSessionUpdatedAt(record),
      pid: record.detail?.pid,
      description: resolveCliSessionDescription(record),
      resumeCommand: sessionId === '' ? '' : formatResumeCommand(sessionId),
      stopCommand: status === 'running' && sessionId !== '' ? formatStopCommand(sessionId) : '',
      killCommand: status === 'running' && sessionId !== '' ? formatKillCommand(sessionId) : ''
    } satisfies ListRow
  })
)

const renderListRows = (rows: ListRow[], view: ListView) => {
  switch (view) {
    case 'compact':
      return rows.map((row) => ({
        Session: row.sessionId,
        Status: row.status,
        Updated: formatUpdatedAt(row.updatedAt),
        Description: truncate(row.description, 72)
      }))
    case 'default':
      return rows.map((row) => ({
        Session: row.sessionId,
        Status: row.status,
        Adapter: row.adapter,
        Model: row.model,
        Updated: formatUpdatedAt(row.updatedAt),
        Description: truncate(row.description, 72)
      }))
    case 'full':
      return rows.map((row) => ({
        Session: row.sessionId,
        Context: row.ctxId,
        Status: row.status,
        Adapter: row.adapter,
        Model: row.model,
        Updated: formatUpdatedAt(row.updatedAt),
        PID: row.pid ?? '',
        Description: truncate(row.description, 72),
        Resume: row.resumeCommand,
        Stop: row.stopCommand,
        Kill: row.killCommand
      }))
  }
}

const buildListHints = (rows: ListRow[], view: ListView) => {
  const hints: string[] = []
  const latest = rows[0]
  const running = rows.find(row => row.stopCommand !== '')

  if (latest?.resumeCommand) {
    hints.push(`Resume latest: ${latest.resumeCommand}`)
  }
  if (running?.stopCommand) {
    hints.push(`Stop a running session: ${running.stopCommand}`)
  }

  switch (view) {
    case 'compact':
      hints.push(`More columns: ${formatListCommand({ view: 'default' })}`)
      break
    case 'default':
      hints.push(`All columns: ${formatListCommand({ view: 'full' })}`)
      break
    case 'full':
      break
  }

  return hints
}

const printListHints = (rows: ListRow[], view: ListView) => {
  const hints = buildListHints(rows, view)
  if (hints.length === 0) return
  console.log(`Tips:\n  ${hints.join('\n  ')}`)
}

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
    .addOption(
      new Option('--view <view>', 'Display view')
        .choices([...LIST_VIEWS])
        .default('compact')
    )
    .option('--verbose', 'Alias for --view full', false)
    .addHelpText(
      'after',
      `
Examples:
  vf list
  vf list --view default
  vf list --view full
  vf list --running
`
    )
    .action(async (opts: ListOptions) => {
      try {
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
        const view = resolveListView(opts.view, opts.verbose)
        const rows = buildListRows(records)
          .filter((record) => (
            requestedStatuses.size === 0 ||
            (record.status !== 'unknown' && requestedStatuses.has(record.status))
          ))
          .slice(0, limit)

        if (rows.length === 0) {
          console.log('No cached sessions matched the requested filters.')
          return
        }

        if (opts.json) {
          console.log(JSON.stringify(rows, null, 2))
          return
        }

        console.table(renderListRows(rows, view))
        printListHints(rows, view)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(message)
        process.exit(1)
      }
    })
}
