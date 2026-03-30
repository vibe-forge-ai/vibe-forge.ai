import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import type { Command } from 'commander'
import fg from 'fast-glob'

const CLEAR_TARGETS = [
  '.logs',
  '.ai/logs',
  '.ai/caches',
  '.ai/.mock/.claude/debug',
  '.ai/.mock/.claude/todos',
  '.ai/.mock/.claude/session-env',
  '.ai/.mock/.claude/projects',
  '.ai/.mock/.claude-core-router/logs',
  '.ai/.mock/.claude-code-router/logs'
] as const

const BENCHMARK_LOG_PATTERNS = [
  '.ai/benchmarks/specs/**/logs',
  '.ai/benchmarks/entities/**/logs',
  '.ai/benchmarks/cases/**/logs'
] as const

const CLAUDE_CODE_ROUTER_LOG_FILE_PATTERNS = [
  '.ai/.mock/.claude-code-router/*.log',
  '.ai/.mock/.claude-code-router/*.log.*'
] as const

const CLAUDE_CODE_ROUTER_SESSION_LOG_PATTERN = '.ai/.mock/.claude-code-router/*/logs'

export interface RunClearCommandOptions {
  cwd?: string
}

async function collectClearTargets(cwd: string) {
  const benchmarkLogDirs = await fg(BENCHMARK_LOG_PATTERNS, {
    cwd,
    onlyDirectories: true,
    deep: 10
  })

  const claudeCodeRouterSessionLogDirs = await fg(CLAUDE_CODE_ROUTER_SESSION_LOG_PATTERN, {
    cwd,
    onlyDirectories: true,
    deep: 2
  })

  const claudeCodeRouterLogFiles = await fg(CLAUDE_CODE_ROUTER_LOG_FILE_PATTERNS, {
    cwd,
    onlyFiles: true,
    deep: 1
  })

  return [
    ...CLEAR_TARGETS,
    ...benchmarkLogDirs.filter(dir => dir !== '.ai/logs' && !dir.startsWith('.ai/logs/')),
    ...claudeCodeRouterSessionLogDirs.map(dir => path.dirname(dir)),
    ...claudeCodeRouterLogFiles
  ]
}

export async function runClearCommand(options: RunClearCommandOptions = {}) {
  const cwd = options.cwd ?? process.cwd()
  const targets = Array.from(new Set(await collectClearTargets(cwd)))

  await Promise.all(
    targets.map(target => fs.rm(path.resolve(cwd, target), { force: true, recursive: true }))
  )

  await Promise.all([
    fs.mkdir(path.resolve(cwd, '.ai/logs'), { recursive: true }),
    fs.mkdir(path.resolve(cwd, '.ai/caches'), { recursive: true })
  ])

  await Promise.all([
    fs.writeFile(path.resolve(cwd, '.ai/logs/.gitkeep'), ''),
    fs.writeFile(path.resolve(cwd, '.ai/caches/.gitkeep'), '')
  ])

  console.log('Clear logs and cache successfully')
}

export function registerClearCommand(program: Command) {
  program
    .command('clear')
    .description('Clear logs and cache of sub-agents')
    .action(async () => {
      await runClearCommand()
    })
}
