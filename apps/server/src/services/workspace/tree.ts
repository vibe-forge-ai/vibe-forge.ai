import { readdir } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

import { getWorkspaceFolder } from '#~/services/config/index.js'
import { badRequest, notFound } from '#~/utils/http.js'

const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.logs',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules'
])

export interface WorkspaceTreeEntry {
  path: string
  name: string
  type: 'file' | 'directory'
}

const normalizeWorkspacePath = (workspaceFolder: string, rawPath?: string) => {
  const trimmed = rawPath?.trim() ?? ''
  if (trimmed === '' || trimmed === '.') {
    return ''
  }

  if (isAbsolute(trimmed)) {
    throw badRequest('Workspace tree path must be relative', { path: rawPath }, 'invalid_workspace_tree_path')
  }

  const resolved = resolve(workspaceFolder, trimmed)
  const nextPath = relative(workspaceFolder, resolved).replaceAll('\\', '/')
  if (nextPath === '' || nextPath === '.') {
    return ''
  }
  if (nextPath === '..' || nextPath.startsWith('../')) {
    throw badRequest('Workspace tree path escapes the workspace root', { path: rawPath }, 'invalid_workspace_tree_path')
  }

  return nextPath
}

export const listWorkspaceTree = async (rawPath?: string) => {
  const workspaceFolder = getWorkspaceFolder()
  const normalizedPath = normalizeWorkspacePath(workspaceFolder, rawPath)
  const targetPath = resolve(workspaceFolder, normalizedPath)

  let entries
  try {
    entries = await readdir(targetPath, { withFileTypes: true })
  } catch (error) {
    throw notFound('Workspace tree path not found', { path: rawPath }, 'workspace_tree_path_not_found')
  }

  const result: WorkspaceTreeEntry[] = []
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue
    }
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
        continue
      }
      result.push({
        path: normalizedPath === '' ? entry.name : `${normalizedPath}/${entry.name}`,
        name: entry.name,
        type: 'directory'
      })
      continue
    }
    if (entry.isFile()) {
      result.push({
        path: normalizedPath === '' ? entry.name : `${normalizedPath}/${entry.name}`,
        name: entry.name,
        type: 'file'
      })
    }
  }

  result.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1
    }
    return left.name.localeCompare(right.name)
  })

  return {
    path: normalizedPath,
    entries: result
  }
}
