import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { resolveProjectAiBaseDir, resolveProjectAiBaseDirName, resolveProjectAiPath } from '@vibe-forge/utils'
import type { Command } from 'commander'
const REPORT_TARGETS = ['logs', 'caches'] as const
const REPORT_MOCK_TARGETS = [
  '.mock/.claude',
  '.mock/.claude-code-router',
  '.mock/.config',
  '.mock/.codex',
  '.mock/.vf'
] as const
const REPORT_MOCK_FILE_PREFIX = '.claude.json'
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

const collectExistingTargets = async (cwd: string, targets: readonly string[]) => {
  const availableTargets: string[] = []

  for (const target of targets) {
    try {
      const resolvedTarget = resolveProjectAiPath(cwd, process.env, ...target.split('/'))
      await fs.access(resolvedTarget, constants.F_OK)
      availableTargets.push(resolvedTarget)
    } catch {
      // ignore missing targets
    }
  }

  return availableTargets
}

const collectMockReportTargets = async (cwd: string) => {
  const availableTargets = await collectExistingTargets(cwd, REPORT_MOCK_TARGETS)
  const mockRoot = resolveProjectAiPath(cwd, process.env, '.mock')

  try {
    const entries = await fs.readdir(mockRoot, { withFileTypes: true })
    const mockFiles = entries
      .filter(entry =>
        entry.isFile() && (
          entry.name === REPORT_MOCK_FILE_PREFIX ||
          entry.name.startsWith(`${REPORT_MOCK_FILE_PREFIX}.backup`)
        )
      )
      .map(entry => path.resolve(mockRoot, entry.name))
      .sort((left, right) => left.localeCompare(right))

    availableTargets.push(...mockFiles)
  } catch {
    // ignore missing mock root
  }

  return availableTargets
}

export const collectReportTargets = async (cwd: string) => {
  const availableTargets = await collectExistingTargets(cwd, REPORT_TARGETS)
  availableTargets.push(...await collectMockReportTargets(cwd))
  return availableTargets
}

const assertArchivePath = (archivePath: string, sources: string[]) => {
  const resolvedArchivePath = path.resolve(archivePath)

  for (const source of sources) {
    if (
      resolvedArchivePath === source ||
      resolvedArchivePath.startsWith(`${source}${path.sep}`)
    ) {
      throw new Error(`Report archive must not be created inside ${source}.`)
    }
  }
}

const createTarArchive = async (cwd: string, archivePath: string, sources: string[]) => {
  const aiBaseDir = resolveProjectAiBaseDir(cwd, process.env)
  const archiveRoot = path.dirname(aiBaseDir)
  const archiveBaseDir = path.relative(archiveRoot, aiBaseDir).split(path.sep).join('/')
  const tarExcludes = [
    `${archiveBaseDir}/.mock/.config/**/node_modules`,
    `${archiveBaseDir}/.mock/.config/**/node_modules/*`
  ]
  const archiveSources = sources.map(source => path.relative(archiveRoot, source))

  await fs.mkdir(path.dirname(archivePath), { recursive: true })

  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', [
      '-czf',
      archivePath,
      ...tarExcludes.map(pattern => `--exclude=${pattern}`),
      '-C',
      archiveRoot,
      ...archiveSources
    ], {
      cwd: archiveRoot,
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
    console.log(`No reportable files found under ${resolveProjectAiBaseDirName(process.env)}.`)
    return null
  }

  const archivePath = resolveReportArchivePath(cwd, options.filename)
  assertArchivePath(archivePath, sources)
  await createTarArchive(cwd, archivePath, sources)

  console.log(`Report archive created: ${archivePath}`)

  return { archivePath, sources }
}

export function registerReportCommand(program: Command) {
  program
    .command('report [filename]')
    .description('Package workspace logs, caches and selected mock data into a compressed archive')
    .action(async (filename?: string) => {
      try {
        await runReportCommand({ filename })
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })
}
