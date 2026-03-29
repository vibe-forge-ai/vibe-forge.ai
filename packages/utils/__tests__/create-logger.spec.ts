import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLogger } from '#~/create-logger.js'

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      return listFiles(entryPath)
    }
    return [entryPath]
  }))
  return files.flat()
}

describe('createLogger', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    vi.useRealTimers()
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it('creates a canonical session log file under the task log directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'vf-create-logger-'))
    tempDirs.push(cwd)

    const logger = createLogger(cwd, 'task-1', 'session-1')
    logger.info('hello')
    await new Promise<void>((resolve) => {
      logger.stream.end(() => resolve())
    })

    const files = await listFiles(join(cwd, '.ai/logs/task-1'))
    expect(files).toEqual([join(cwd, '.ai/logs/task-1/session-1.log.md')])
    expect(await readFile(files[0]!, 'utf8')).toContain('hello')
  })

  it('uses info as the default level', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'vf-create-logger-'))
    tempDirs.push(cwd)

    const logger = createLogger(cwd, 'task-1', 'session-1')
    logger.debug('Claude Code CLI stdout:', { line: 'hidden by default' })
    logger.info('hello')
    await new Promise<void>((resolve) => {
      logger.stream.end(() => resolve())
    })

    const canonicalPath = join(cwd, '.ai/logs/task-1/session-1.log.md')
    const content = await readFile(canonicalPath, 'utf8')
    expect(content).toContain('__I__ hello')
    expect(content).not.toContain('Claude Code CLI stdout:')
    expect(content).not.toContain('__D__')
  })

  it('keeps writing resumed logs into the canonical session file even if legacy dated logs exist', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'vf-create-logger-'))
    tempDirs.push(cwd)

    const legacyDir = join(cwd, '.ai/logs/task-1/2026-3-19-22')
    const legacyPath = join(legacyDir, 'session-1.log.md')
    const canonicalPath = join(cwd, '.ai/logs/task-1/session-1.log.md')
    await mkdir(legacyDir, { recursive: true })
    await writeFile(legacyPath, '# legacy log\n')

    const logger = createLogger(cwd, 'task-1', 'session-1')
    logger.info('follow up')
    await new Promise<void>((resolve) => {
      logger.stream.end(() => resolve())
    })

    const files = await listFiles(join(cwd, '.ai/logs/task-1'))
    expect(files.sort()).toEqual([canonicalPath, legacyPath].sort())
    expect(await readFile(canonicalPath, 'utf8')).toContain('follow up')
    expect(await readFile(legacyPath, 'utf8')).toBe('# legacy log\n')
  })

  it('skips debug entries when log level is info', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'vf-create-logger-'))
    tempDirs.push(cwd)

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T10:00:00.000Z'))

    const logger = createLogger(cwd, 'task-1', 'session-1', '', 'info')
    logger.debug('Claude Code CLI stdout:', { line: 'debug only' })
    logger.info('session started')
    await new Promise<void>((resolve) => {
      logger.stream.end(() => resolve())
    })

    const canonicalPath = join(cwd, '.ai/logs/task-1/session-1.log.md')
    const content = await readFile(canonicalPath, 'utf8')
    expect(content).toContain('__I__ session started')
    expect(content).not.toContain('Claude Code CLI stdout:')
    expect(content).not.toContain('__D__')
  })

  it('keeps debug entries when log level is debug', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'vf-create-logger-'))
    tempDirs.push(cwd)

    const logger = createLogger(cwd, 'task-1', 'session-1', '', 'debug')
    logger.debug('Claude Code CLI stdout:', { line: 'debug enabled' })
    await new Promise<void>((resolve) => {
      logger.stream.end(() => resolve())
    })

    const canonicalPath = join(cwd, '.ai/logs/task-1/session-1.log.md')
    const content = await readFile(canonicalPath, 'utf8')
    expect(content).toContain('__D__ Claude Code CLI stdout:')
    expect(content).toContain('"line": "debug enabled"')
  })
})
