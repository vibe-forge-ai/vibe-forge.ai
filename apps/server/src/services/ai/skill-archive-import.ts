import { execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { copyFile, lstat, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { promisify } from 'node:util'

import type { IncomingMessage } from 'node:http'

import { badRequest, internalServerError } from '#~/utils/http.js'
import { pipeline } from 'node:stream/promises'

const execFileAsync = promisify(execFile)
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024

const decodeArchiveName = (value: string | undefined) => {
  if (value == null || value.trim() === '') return 'skills-archive'
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const sanitizeArchiveName = (value: string) => {
  const base = path.basename(value).replace(/[^\w.-]+/g, '-')
  return base === '' ? 'skills-archive' : base
}

const assertSafeArchiveEntries = async (archivePath: string) => {
  const { stdout } = await execFileAsync('/usr/bin/bsdtar', ['-tf', archivePath], { maxBuffer: 10 * 1024 * 1024 })
  const entries = stdout.split('\n').map(entry => entry.trim()).filter(Boolean)

  if (entries.length === 0) {
    throw badRequest('Archive is empty', undefined, 'empty_archive')
  }

  for (const entry of entries) {
    if (entry.includes('\0') || entry.startsWith('/') || /^[a-z]:/i.test(entry)) {
      throw badRequest('Archive contains unsafe paths', { entry }, 'unsafe_archive_path')
    }

    const normalized = path.posix.normalize(entry)
    if (normalized === '..' || normalized.startsWith('../')) {
      throw badRequest('Archive contains unsafe paths', { entry }, 'unsafe_archive_path')
    }
  }
}

const copyRegularFiles = async (sourceDir: string, targetDir: string) => {
  let fileCount = 0
  const entries = await readdir(sourceDir, { withFileTypes: true })

  await mkdir(targetDir, { recursive: true })

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name)
    const targetPath = join(targetDir, entry.name)
    const stat = await lstat(sourcePath)

    if (stat.isDirectory()) {
      fileCount += await copyRegularFiles(sourcePath, targetPath)
      continue
    }

    if (!stat.isFile()) continue

    await mkdir(path.dirname(targetPath), { recursive: true })
    await copyFile(sourcePath, targetPath)
    fileCount += 1
  }

  return fileCount
}

const writeArchive = async (req: IncomingMessage, archivePath: string) => {
  const contentLength = Number(req.headers['content-length'] ?? 0)
  if (contentLength > MAX_ARCHIVE_BYTES) {
    throw badRequest('Archive is too large', { maxBytes: MAX_ARCHIVE_BYTES }, 'archive_too_large')
  }

  await pipeline(req, createWriteStream(archivePath))
}

export const importSkillArchive = async (
  workspaceRoot: string,
  req: IncomingMessage,
  archiveNameHeader: string | undefined
) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'vf-skill-import-'))
  const archiveName = sanitizeArchiveName(decodeArchiveName(archiveNameHeader))
  const archivePath = join(tempRoot, archiveName)
  const extractDir = join(tempRoot, 'extract')
  const skillsDir = join(workspaceRoot, '.ai', 'skills')

  try {
    await mkdir(extractDir, { recursive: true })
    await writeArchive(req, archivePath)
    await assertSafeArchiveEntries(archivePath)
    await execFileAsync('/usr/bin/bsdtar', ['-xf', archivePath, '-C', extractDir])
    const fileCount = await copyRegularFiles(extractDir, skillsDir)

    return {
      fileCount,
      targetDir: '.ai/skills'
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err
    throw internalServerError('Failed to import skill archive', { cause: err, code: 'skill_archive_import_failed' })
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}
