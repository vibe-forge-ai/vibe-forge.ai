import { createApiUrl, fetchApiJson, jsonHeaders } from './base'

export interface WorkspaceTreeEntry {
  isExternal?: boolean
  isSymlink?: boolean
  linkKind?: 'gitdir' | 'symlink'
  linkTarget?: string
  linkType?: 'directory' | 'file' | 'missing' | 'other'
  path: string
  name: string
  type: 'file' | 'directory'
}

export interface WorkspaceFileContent {
  content: string
  encoding: 'utf-8'
  path: string
  size: number
}

export async function listWorkspaceTree(path?: string) {
  const url = createApiUrl('/api/workspace/tree')
  if (path != null && path.trim() !== '') {
    url.searchParams.set('path', path)
  }

  return fetchApiJson<{
    path: string
    entries: WorkspaceTreeEntry[]
  }>(url)
}

export async function readWorkspaceFile(path: string): Promise<WorkspaceFileContent> {
  const url = createApiUrl('/api/workspace/file')
  url.searchParams.set('path', path)
  return fetchApiJson<WorkspaceFileContent>(url)
}

export function getWorkspaceResourceUrl(path: string) {
  const url = createApiUrl('/api/workspace/resource')
  url.searchParams.set('path', path)
  return url.toString()
}

export async function updateWorkspaceFile(path: string, content: string): Promise<WorkspaceFileContent> {
  return fetchApiJson<WorkspaceFileContent>('/api/workspace/file', {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ path, content })
  })
}
