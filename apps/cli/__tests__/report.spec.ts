import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  collectReportTargets,
  resolveReportArchivePath,
  runReportCommand
} from '#~/commands/report.js'

const tempDirs: string[] = []

const createTempDir = async () => {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'vf-report-'))
  tempDirs.push(cwd)
  return cwd
}

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { force: true, recursive: true })))
})

describe('report command', () => {
  it('uses a timestamped tar.gz filename by default', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T03:04:05.000Z'))

    const cwd = await createTempDir()

    expect(resolveReportArchivePath(cwd)).toBe(path.join(cwd, 'report-20260320T030405Z.tar.gz'))
  })

  it('collects only existing report targets', async () => {
    const cwd = await createTempDir()

    await fs.mkdir(path.join(cwd, '.ai/logs'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock'), { recursive: true })

    expect(await collectReportTargets(cwd)).toEqual(['.ai/logs', '.ai/.mock'])
  })

  it('creates an archive containing .ai logs, caches and mock data', async () => {
    const cwd = await createTempDir()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await fs.mkdir(path.join(cwd, '.ai/logs'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/caches'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock'), { recursive: true })

    await fs.writeFile(path.join(cwd, '.ai/logs/session.log'), 'log data')
    await fs.writeFile(path.join(cwd, '.ai/caches/task.json'), '{"ok":true}')
    await fs.writeFile(path.join(cwd, '.ai/.mock/config.json'), '{"mock":true}')

    const result = await runReportCommand({ cwd, filename: 'bundle' })

    expect(result).not.toBeNull()
    expect(result?.archivePath).toBe(path.join(cwd, 'bundle.tar.gz'))

    const archiveListing = execFileSync('tar', ['-tzf', result!.archivePath], {
      encoding: 'utf-8'
    })

    expect(archiveListing).toContain('.ai/logs/session.log')
    expect(archiveListing).toContain('.ai/caches/task.json')
    expect(archiveListing).toContain('.ai/.mock/config.json')
    expect(logSpy).toHaveBeenCalledWith(`Report archive created: ${result!.archivePath}`)
  })

  it('returns null when no report targets exist', async () => {
    const cwd = await createTempDir()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await runReportCommand({ cwd })

    expect(result).toBeNull()
    expect(logSpy).toHaveBeenCalledWith('No reportable files found under .ai.')
  })

  it('rejects archive paths inside included directories', async () => {
    const cwd = await createTempDir()

    await fs.mkdir(path.join(cwd, '.ai/logs'), { recursive: true })

    await expect(runReportCommand({
      cwd,
      filename: '.ai/logs/report'
    })).rejects.toThrow('Report archive must not be created inside .ai/logs.')
  })
})
