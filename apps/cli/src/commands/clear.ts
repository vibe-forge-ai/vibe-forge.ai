import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { resolveProjectAiBaseDirName, resolveProjectAiPath } from '@vibe-forge/utils'
import type { Command } from 'commander'
import fg from 'fast-glob'

const CLEAR_AI_TARGETS = [
  'logs',
  'caches',
  '.mock/.claude/debug',
  '.mock/.claude/todos',
  '.mock/.claude/session-env',
  '.mock/.claude/projects',
  '.mock/.claude-core-router/logs',
  '.mock/.claude-code-router/logs'
] as const

const BENCHMARK_LOG_PATTERNS = [
  'benchmarks/specs/**/logs',
  'benchmarks/entities/**/logs',
  'benchmarks/cases/**/logs'
] as const

const CLAUDE_CODE_ROUTER_LOG_FILE_PATTERNS = [
  '.mock/.claude-code-router/*.log',
  '.mock/.claude-code-router/*.log.*'
] as const

const CLAUDE_CODE_ROUTER_SESSION_LOG_PATTERN = '.mock/.claude-code-router/*/logs'

export interface RunClearCommandOptions {
  cwd?: string
}

async function collectClearTargets(cwd: string) {
  const aiBaseDir = resolveProjectAiPath(cwd, process.env)
  const logsDir = resolveProjectAiPath(cwd, process.env, 'logs')
  const benchmarkLogDirs = await fg([...BENCHMARK_LOG_PATTERNS], {
    cwd: aiBaseDir,
    onlyDirectories: true,
    deep: 10,
    absolute: true
  })

  const claudeCodeRouterSessionLogDirs = await fg(CLAUDE_CODE_ROUTER_SESSION_LOG_PATTERN, {
    cwd: aiBaseDir,
    onlyDirectories: true,
    deep: 2,
    absolute: true
  })

  const claudeCodeRouterLogFiles = await fg([...CLAUDE_CODE_ROUTER_LOG_FILE_PATTERNS], {
    cwd: aiBaseDir,
    onlyFiles: true,
    deep: 1,
    absolute: true
  })

  return [
    path.resolve(cwd, '.logs'),
    ...CLEAR_AI_TARGETS.map(target => resolveProjectAiPath(cwd, process.env, ...target.split('/'))),
    ...benchmarkLogDirs.filter(dir => dir !== logsDir && !dir.startsWith(`${logsDir}${path.sep}`)),
    ...claudeCodeRouterSessionLogDirs.map(dir => path.dirname(dir)),
    ...claudeCodeRouterLogFiles
  ]
}

export async function runClearCommand(options: RunClearCommandOptions = {}) {
  const cwd = options.cwd ?? process.cwd()
  const targets = Array.from(new Set(await collectClearTargets(cwd)))

  await Promise.all(
    targets.map(target => fs.rm(target, { force: true, recursive: true }))
  )

  await Promise.all([
    fs.mkdir(resolveProjectAiPath(cwd, process.env, 'logs'), { recursive: true }),
    fs.mkdir(resolveProjectAiPath(cwd, process.env, 'caches'), { recursive: true })
  ])

  await Promise.all([
    fs.writeFile(resolveProjectAiPath(cwd, process.env, 'logs', '.gitkeep'), ''),
    fs.writeFile(resolveProjectAiPath(cwd, process.env, 'caches', '.gitkeep'), '')
  ])

  console.log(`Clear logs and cache successfully (${resolveProjectAiBaseDirName(process.env)})`)
}

export function registerClearCommand(program: Command) {
  program
    .command('clear')
    .description('Clear logs and cache of sub-agents')
    .action(async () => {
      await runClearCommand()
    })
}
