import { Buffer } from 'node:buffer'
import { lstat, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { TextDecoder } from 'node:util'

import { getWorkspaceFolder } from '#~/services/config/index.js'
import { badRequest, notFound } from '#~/utils/http.js'

import { assertWorkspacePathInsideRealRoot, normalizeWorkspacePath, readGitdirFileTarget } from './tree'

const MAX_WORKSPACE_FILE_BYTES = 2 * 1024 * 1024

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  apng: 'image/apng',
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp'
}

export interface WorkspaceFileContent {
  content: string
  encoding: 'utf-8'
  path: string
  size: number
}

export interface WorkspaceImageResource {
  filePath: string
  mimeType: string
  path: string
  size: number
}

const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

const getFileExtension = (path: string) => {
  const fileName = path.split('/').filter(Boolean).at(-1) ?? path
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex <= 0 ? '' : fileName.slice(dotIndex + 1).toLowerCase()
}

const resolveWorkspaceFileEntryPath = async (
  rawPath: string | undefined,
  options: { workspaceFolder?: string } = {}
) => {
  const workspaceFolder = options.workspaceFolder ?? getWorkspaceFolder()
  const normalizedPath = normalizeWorkspacePath(workspaceFolder, rawPath)
  if (normalizedPath === '') {
    throw badRequest('Workspace file path is required', { path: rawPath }, 'workspace_file_path_required')
  }

  const filePath = resolve(workspaceFolder, normalizedPath)
  let fileStat
  try {
    const symlinkStat = await lstat(filePath)
    fileStat = symlinkStat.isSymbolicLink() ? await stat(filePath) : symlinkStat
  } catch {
    throw notFound('Workspace file not found', { path: rawPath }, 'workspace_file_not_found')
  }

  await assertWorkspacePathInsideRealRoot(
    workspaceFolder,
    filePath,
    rawPath,
    'workspace_file_path_escapes_workspace'
  )

  if (!fileStat.isFile()) {
    throw badRequest('Workspace path is not a file', { path: rawPath }, 'workspace_path_not_file')
  }

  if ((normalizedPath === '.git' || normalizedPath.endsWith('/.git')) && await readGitdirFileTarget(filePath) != null) {
    throw badRequest('Workspace path is a Git metadata link', { path: rawPath }, 'workspace_file_gitdir_pointer')
  }

  return { filePath, fileStat, normalizedPath }
}

const resolveWorkspaceFilePath = async (
  rawPath: string | undefined,
  options: { workspaceFolder?: string } = {}
) => {
  const resolved = await resolveWorkspaceFileEntryPath(rawPath, options)

  if (resolved.fileStat.size > MAX_WORKSPACE_FILE_BYTES) {
    throw badRequest(
      'Workspace file is too large to edit',
      { maxSize: MAX_WORKSPACE_FILE_BYTES, path: rawPath, size: resolved.fileStat.size },
      'workspace_file_too_large'
    )
  }

  return resolved
}

const assertEditableTextFile = async (filePath: string, rawPath: string | undefined) => {
  const buffer = await readFile(filePath)
  if (buffer.includes(0)) {
    throw badRequest('Workspace file appears to be binary', { path: rawPath }, 'workspace_file_binary')
  }

  try {
    utf8Decoder.decode(buffer)
  } catch {
    throw badRequest('Workspace file is not valid UTF-8', { path: rawPath }, 'workspace_file_invalid_encoding')
  }

  return buffer
}

export const readWorkspaceFile = async (
  rawPath: string | undefined,
  options: { workspaceFolder?: string } = {}
): Promise<WorkspaceFileContent> => {
  const { filePath, normalizedPath } = await resolveWorkspaceFilePath(rawPath, options)
  const buffer = await assertEditableTextFile(filePath, rawPath)
  const content = utf8Decoder.decode(buffer)

  return {
    path: normalizedPath,
    content,
    encoding: 'utf-8',
    size: buffer.byteLength
  }
}

export const resolveWorkspaceImageResource = async (
  rawPath: string | undefined,
  options: { workspaceFolder?: string } = {}
): Promise<WorkspaceImageResource> => {
  const { filePath, fileStat, normalizedPath } = await resolveWorkspaceFileEntryPath(rawPath, options)
  const mimeType = IMAGE_MIME_BY_EXTENSION[getFileExtension(normalizedPath)]
  if (mimeType == null) {
    throw badRequest('Workspace resource is not a supported image', { path: rawPath }, 'workspace_resource_not_image')
  }

  return {
    filePath,
    mimeType,
    path: normalizedPath,
    size: fileStat.size
  }
}

export const updateWorkspaceFile = async (
  rawPath: string | undefined,
  content: unknown,
  options: { workspaceFolder?: string } = {}
): Promise<WorkspaceFileContent> => {
  if (typeof content !== 'string') {
    throw badRequest('Workspace file content must be a string', { path: rawPath }, 'workspace_file_content_invalid')
  }

  const size = Buffer.byteLength(content, 'utf8')
  if (size > MAX_WORKSPACE_FILE_BYTES) {
    throw badRequest(
      'Workspace file is too large to edit',
      { maxSize: MAX_WORKSPACE_FILE_BYTES, path: rawPath, size },
      'workspace_file_too_large'
    )
  }

  const { filePath, normalizedPath } = await resolveWorkspaceFilePath(rawPath, options)
  await assertEditableTextFile(filePath, rawPath)
  await writeFile(filePath, content, 'utf8')

  return {
    path: normalizedPath,
    content,
    encoding: 'utf-8',
    size
  }
}
