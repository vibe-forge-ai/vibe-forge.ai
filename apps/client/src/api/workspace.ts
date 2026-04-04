import { createApiUrl, fetchApiJson } from './base'

export interface WorkspaceTreeEntry {
  path: string
  name: string
  type: 'file' | 'directory'
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
