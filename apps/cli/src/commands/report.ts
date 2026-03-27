import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import type { Command } from 'commander'

const REPORT_TARGETS = ['.ai/logs', '.ai/caches', '.ai/.mock'] as const

const pad = (value: number) => String(value).padStart(2, '0')

export const formatReportTimestamp = (date: Date) => {
  const day = [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate())
  ].join('')
  const time = [
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds())
  ].join('')

  return `${day}T${time}Z`
}

export const resolveReportArchivePath = (cwd: string, filename?: string) => {
  const baseName = filename?.trim()
    ? filename.trim()
    : `report-${formatReportTimestamp(new Date())}`

  const archiveName = baseName.endsWith('.tar.gz') || baseName.endsWith('.tgz')
    ? baseName
    : `${baseName}.tar.gz`

  return path.resolve(cwd, archiveName)
}

export const collectReportTargets = async (cwd: string) => {
  const availableTargets: string[] = []

  for (const target of REPORT_TARGETS) {
    try {
      await fs.access(path.resolve(cwd, target), constants.F_OK)
      availableTargets.push(target)
    } catch {
      // ignore missing targets
    }
  }

  return availableTargets
}

const assertArchivePath = (cwd: string, archivePath: string, sources: string[]) => {
  const resolvedArchivePath = path.resolve(archivePath)

  for (const source of sources) {
    const resolvedSourcePath = path.resolve(cwd, source)
    if (
      resolvedArchivePath === resolvedSourcePath ||
      resolvedArchivePath.startsWith(`${resolvedSourcePath}${path.sep}`)
    ) {
      throw new Error(`Report archive must not be created inside ${source}.`)
    }
  }
}

const createTarArchive = async (cwd: string, archivePath: string, sources: string[]) => {
  await fs.mkdir(path.dirname(archivePath), { recursive: true })

  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', ['-czf', archivePath, '-C', cwd, ...sources], {
      cwd,
      stdio: ['ignore', 'ignore', 'pipe']
    })

    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('error', (error) => {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        reject(new Error('Failed to create report archive: `tar` command not found.'))
        return
      }
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      const message = stderr.trim()
      reject(
        new Error(
          message
            ? `Failed to create report archive: ${message}`
            : `Failed to create report archive with exit code ${code ?? -1}.`
        )
      )
    })
  })
}

export interface RunReportCommandOptions {
  cwd?: string
  filename?: string
}

export async function runReportCommand(options: RunReportCommandOptions = {}) {
  const cwd = options.cwd ?? process.cwd()
  const sources = await collectReportTargets(cwd)

  if (sources.length === 0) {
    console.log('No reportable files found under .ai.')
    return null
  }

  const archivePath = resolveReportArchivePath(cwd, options.filename)
  assertArchivePath(cwd, archivePath, sources)
  await createTarArchive(cwd, archivePath, sources)

  console.log(`Report archive created: ${archivePath}`)

  return {
    archivePath,
    sources
  }
}

export function registerReportCommand(program: Command) {
  program
    .command('report [filename]')
    .description('Package .ai logs, caches and mock data into a compressed archive')
    .action(async (filename?: string) => {
      try {
        await runReportCommand({ filename })
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })
}
