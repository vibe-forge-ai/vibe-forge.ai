import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { collectReportTargets, resolveReportArchivePath, runReportCommand } from '#~/commands/report.js'

const tempDirs: string[] = []

const createTempDir = async () => {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'vf-report-'))
  tempDirs.push(cwd)
  return cwd
}

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete process.env.__VF_PROJECT_AI_BASE_DIR__
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
    await fs.mkdir(path.join(cwd, '.ai/.mock/.claude'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.config/opencode/node_modules'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.vf'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.bun'), { recursive: true })
    await fs.writeFile(path.join(cwd, '.ai/.mock/.claude.json.backup.1774599210661'), '{}')
    await fs.writeFile(path.join(cwd, '.ai/.mock/ignored.json'), '{}')

    expect(await collectReportTargets(cwd)).toEqual([
      path.join(cwd, '.ai/logs'),
      path.join(cwd, '.ai/.mock/.claude'),
      path.join(cwd, '.ai/.mock/.config'),
      path.join(cwd, '.ai/.mock/.vf'),
      path.join(cwd, '.ai/.mock/.claude.json.backup.1774599210661')
    ])
  })

  it('creates an archive containing .ai logs, caches and selected mock data', async () => {
    const cwd = await createTempDir()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await fs.mkdir(path.join(cwd, '.ai/logs'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/caches'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.claude'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.config/opencode/plugins'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.config/opencode/node_modules/pkg'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.codex'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.vf'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.bun'), { recursive: true })

    await fs.writeFile(path.join(cwd, '.ai/logs/session.log'), 'log data')
    await fs.writeFile(path.join(cwd, '.ai/caches/task.json'), '{"ok":true}')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.claude/settings.json'), '{"mock":true}')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.config/opencode/plugins/vibe-forge-hooks.js'), 'export {}')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.config/opencode/node_modules/pkg/index.js'), 'module.exports = {}')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.codex/hooks.json'), '{"hook":true}')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.vf/state.json'), '{"state":true}')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.claude.json.backup.1774599210661'), '{"backup":true}')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.bun/install.log'), 'skip me')

    const result = await runReportCommand({ cwd, filename: 'bundle' })

    expect(result).not.toBeNull()
    expect(result?.archivePath).toBe(path.join(cwd, 'bundle.tar.gz'))

    const archiveListing = execFileSync('tar', ['-tzf', result!.archivePath], {
      encoding: 'utf-8'
    })

    expect(archiveListing).toContain('.ai/logs/session.log')
    expect(archiveListing).toContain('.ai/caches/task.json')
    expect(archiveListing).toContain('.ai/.mock/.claude/settings.json')
    expect(archiveListing).toContain('.ai/.mock/.config/opencode/plugins/vibe-forge-hooks.js')
    expect(archiveListing).toContain('.ai/.mock/.codex/hooks.json')
    expect(archiveListing).toContain('.ai/.mock/.vf/state.json')
    expect(archiveListing).toContain('.ai/.mock/.claude.json.backup.1774599210661')
    expect(archiveListing).not.toContain('.ai/.mock/.bun/install.log')
    expect(archiveListing).not.toContain('.ai/.mock/.config/opencode/node_modules/pkg/index.js')
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
    })).rejects.toThrow(path.join(cwd, '.ai/logs'))
  })

  it('packages files from the env-configured ai base dir', async () => {
    const cwd = await createTempDir()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    process.env.__VF_PROJECT_AI_BASE_DIR__ = '.vf'

    await fs.mkdir(path.join(cwd, '.vf/logs'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.vf/caches'), { recursive: true })
    await fs.writeFile(path.join(cwd, '.vf/logs/session.log'), 'log data')
    await fs.writeFile(path.join(cwd, '.vf/caches/task.json'), '{"ok":true}')

    const result = await runReportCommand({ cwd, filename: 'bundle-vf' })

    expect(result).not.toBeNull()

    const archiveListing = execFileSync('tar', ['-tzf', result!.archivePath], {
      encoding: 'utf-8'
    })

    expect(archiveListing).toContain('.vf/logs/session.log')
    expect(archiveListing).toContain('.vf/caches/task.json')
    expect(logSpy).toHaveBeenCalledWith(`Report archive created: ${result!.archivePath}`)
  })
})
