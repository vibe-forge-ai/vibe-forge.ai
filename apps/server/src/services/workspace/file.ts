import { Buffer } from 'node:buffer'
import { lstat, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { TextDecoder } from 'node:util'

import { getWorkspaceFolder } from '#~/services/config/index.js'
import { badRequest, notFound } from '#~/utils/http.js'

import { normalizeWorkspacePath } from './tree'

const MAX_WORKSPACE_FILE_BYTES = 2 * 1024 * 1024

export interface WorkspaceFileContent {
  content: string
  encoding: 'utf-8'
  path: string
  size: number
}

const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

const resolveWorkspaceFilePath = async (
  rawPath: string | undefined,
  options: { workspaceFolder?: string } = {}
) => {
  const workspaceFolder = options.workspaceFolder ?? getWorkspaceFolder()
  const normalizedPath = normalizeWorkspacePath(workspaceFolder, rawPath)
  if (normalizedPath === '') {
    throw badRequest('Workspace file path is required', { path: rawPath }, 'workspace_file_path_required')
  }

  const filePath = resolve(workspaceFolder, normalizedPath)
  let stat
  try {
    stat = await lstat(filePath)
  } catch {
    throw notFound('Workspace file not found', { path: rawPath }, 'workspace_file_not_found')
  }

  if (!stat.isFile()) {
    throw badRequest('Workspace path is not a file', { path: rawPath }, 'workspace_path_not_file')
  }

  if (stat.size > MAX_WORKSPACE_FILE_BYTES) {
    throw badRequest(
      'Workspace file is too large to edit',
      { maxSize: MAX_WORKSPACE_FILE_BYTES, path: rawPath, size: stat.size },
      'workspace_file_too_large'
    )
  }

  return { filePath, normalizedPath }
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
