import fs from 'node:fs/promises'

import type { Command } from 'commander'
import fg from 'fast-glob'

export function registerClearCommand(program: Command) {
  program
    .command('clear')
    .description('Clear logs and cache of sub-agents')
    .action(async () => {
      // Clean main logs and caches
      await Promise.all([
        fs.rm('.ai/logs', { force: true, recursive: true }),
        fs.rm('.ai/caches', { force: true, recursive: true }),
        fs.rm('.ai/.mock/.claude/debug', { force: true, recursive: true }),
        fs.rm('.ai/.mock/.claude/todos', { force: true, recursive: true }),
        fs.rm('.ai/.mock/.claude/session-env', { force: true, recursive: true }),
        fs.rm('.ai/.mock/.claude/projects', { force: true, recursive: true }),
        fs.rm('.ai/.mock/.claude-core-router/logs', {
          force: true,
          recursive: true,
        }),
      ])

      // Clean all logs directories using fast-glob patterns
      const logsPatterns = [
        '.ai/benchmarks/specs/**/logs',
        '.ai/benchmarks/entities/**/logs',
        '.ai/benchmarks/cases/**/logs',
      ]

      // Find all logs directories
      const logsDirs = await fg(logsPatterns, {
        onlyDirectories: true,
        deep: 10,
      })

      // Remove all found logs directories (exclude main .ai/logs which we handle separately)
      const logsDirsToRemove = logsDirs.filter(
        (dir) => dir !== '.ai/logs' && !dir.startsWith('.ai/logs/'),
      )

      await Promise.all(
        logsDirsToRemove.map((logsDir) =>
          fs.rm(logsDir, { force: true, recursive: true }),
        ),
      )

      // Recreate main directories
      await Promise.all([
        fs.mkdir('.ai/logs', { recursive: true }),
        fs.mkdir('.ai/caches', { recursive: true })
      ])

      // create .gitkeep files
      await Promise.all([
        fs.writeFile('.ai/logs/.gitkeep', ''),
        fs.writeFile('.ai/caches/.gitkeep', ''),
      ])
      console.log('Clear logs and cache successfully')
    })
}
