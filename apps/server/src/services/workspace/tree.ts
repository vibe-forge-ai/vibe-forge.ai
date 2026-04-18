import { readFile, readdir, readlink, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

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
  isExternal?: boolean
  isSymlink?: boolean
  linkKind?: 'gitdir' | 'symlink'
  linkTarget?: string
  linkType?: 'directory' | 'file' | 'missing' | 'other'
}

const isPathInside = (parentPath: string, childPath: string) => {
  const childRelativePath = relative(parentPath, childPath)
  return childRelativePath === '' || (!childRelativePath.startsWith(`..${sep}`) && childRelativePath !== '..' &&
    !isAbsolute(childRelativePath))
}

export const assertWorkspacePathInsideRealRoot = async (
  workspaceFolder: string,
  targetPath: string,
  rawPath: string | undefined,
  code = 'invalid_workspace_tree_path'
) => {
  const workspaceRealPath = await realpath(workspaceFolder)
  const targetRealPath = await realpath(targetPath)
  if (!isPathInside(workspaceRealPath, targetRealPath)) {
    throw badRequest('Workspace path escapes the workspace root through a symlink', { path: rawPath }, code)
  }

  return { targetRealPath, workspaceRealPath }
}

export const normalizeWorkspacePath = (workspaceFolder: string, rawPath?: string) => {
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

export const readGitdirFileTarget = async (filePath: string) => {
  const content = await readFile(filePath, 'utf8').catch(() => undefined)
  const firstLine = content?.split(/\r?\n/, 1)[0]?.trim()
  if (firstLine == null || !firstLine.toLowerCase().startsWith('gitdir:')) {
    return undefined
  }

  const rawTarget = firstLine.slice('gitdir:'.length).trim()
  if (rawTarget === '') {
    return undefined
  }

  return {
    rawTarget,
    resolvedTarget: isAbsolute(rawTarget) ? rawTarget : resolve(dirname(filePath), rawTarget)
  }
}

export const listWorkspaceTree = async (
  rawPath?: string,
  options: {
    workspaceFolder?: string
  } = {}
) => {
  const workspaceFolder = options.workspaceFolder ?? getWorkspaceFolder()
  const normalizedPath = normalizeWorkspacePath(workspaceFolder, rawPath)
  const targetPath = resolve(workspaceFolder, normalizedPath)

  let entries
  let workspaceRealPath = ''
  try {
    const resolvedPaths = await assertWorkspacePathInsideRealRoot(workspaceFolder, targetPath, rawPath)
    workspaceRealPath = resolvedPaths.workspaceRealPath
    entries = await readdir(targetPath, { withFileTypes: true })
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      throw error
    }
    throw notFound('Workspace tree path not found', { path: rawPath }, 'workspace_tree_path_not_found')
  }

  const result: WorkspaceTreeEntry[] = []
  for (const entry of entries) {
    const entryPath = resolve(targetPath, entry.name)
    const path = normalizedPath === '' ? entry.name : `${normalizedPath}/${entry.name}`
    if (entry.isSymbolicLink()) {
      const linkTarget = await readlink(entryPath).catch(() => undefined)
      const linkStat = await stat(entryPath).catch(() => undefined)
      const linkType = linkStat == null
        ? 'missing'
        : linkStat.isDirectory()
        ? 'directory'
        : linkStat.isFile()
        ? 'file'
        : 'other'
      const linkRealPath = await realpath(entryPath).catch(() => undefined)
      const isExternal = linkRealPath == null ? undefined : !isPathInside(workspaceRealPath, linkRealPath)
      const type = linkType === 'directory' ? 'directory' : 'file'

      if (type === 'directory' && IGNORED_DIRECTORY_NAMES.has(entry.name)) {
        continue
      }

      result.push({
        path,
        name: entry.name,
        type,
        isSymlink: true,
        linkKind: 'symlink',
        linkTarget,
        linkType,
        ...(isExternal == null ? {} : { isExternal })
      })
      continue
    }
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
        continue
      }
      result.push({
        path,
        name: entry.name,
        type: 'directory'
      })
      continue
    }
    if (entry.isFile()) {
      const gitdirTarget = entry.name === '.git' ? await readGitdirFileTarget(entryPath) : undefined
      if (gitdirTarget != null) {
        const linkStat = await stat(gitdirTarget.resolvedTarget).catch(() => undefined)
        const linkType = linkStat == null
          ? 'missing'
          : linkStat.isDirectory()
          ? 'directory'
          : linkStat.isFile()
          ? 'file'
          : 'other'
        const linkRealPath = await realpath(gitdirTarget.resolvedTarget).catch(() => undefined)
        const isExternal = linkRealPath == null ? undefined : !isPathInside(workspaceRealPath, linkRealPath)
        result.push({
          path,
          name: entry.name,
          type: 'directory',
          linkKind: 'gitdir',
          linkTarget: gitdirTarget.rawTarget,
          linkType,
          ...(isExternal == null ? {} : { isExternal })
        })
        continue
      }
      result.push({
        path,
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

  return { path: normalizedPath, entries: result }
}
