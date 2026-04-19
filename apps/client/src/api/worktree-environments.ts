import type {
  WorktreeEnvironmentDetail,
  WorktreeEnvironmentListResult,
  WorktreeEnvironmentMutationResult,
  WorktreeEnvironmentSavePayload,
  WorktreeEnvironmentSource
} from '@vibe-forge/types'

import { fetchApiJson, jsonHeaders } from './base'

export async function listWorktreeEnvironments(): Promise<WorktreeEnvironmentListResult> {
  return fetchApiJson<WorktreeEnvironmentListResult>('/api/worktree-environments')
}

const getSourceQuery = (source?: WorktreeEnvironmentSource) => (
  source == null ? '' : `?source=${encodeURIComponent(source)}`
)

export async function getWorktreeEnvironment(
  id: string,
  source?: WorktreeEnvironmentSource
): Promise<{ environment: WorktreeEnvironmentDetail }> {
  return fetchApiJson<{ environment: WorktreeEnvironmentDetail }>(
    `/api/worktree-environments/${encodeURIComponent(id)}${getSourceQuery(source)}`
  )
}

export async function saveWorktreeEnvironment(
  id: string,
  payload: WorktreeEnvironmentSavePayload,
  source?: WorktreeEnvironmentSource
): Promise<WorktreeEnvironmentMutationResult> {
  return fetchApiJson<WorktreeEnvironmentMutationResult>(
    `/api/worktree-environments/${encodeURIComponent(id)}${getSourceQuery(source)}`,
    {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    }
  )
}

export async function deleteWorktreeEnvironment(
  id: string,
  source?: WorktreeEnvironmentSource
): Promise<{ ok: true; removed: boolean }> {
  return fetchApiJson<{ ok: true; removed: boolean }>(
    `/api/worktree-environments/${encodeURIComponent(id)}${getSourceQuery(source)}`,
    {
      method: 'DELETE'
    }
  )
}
