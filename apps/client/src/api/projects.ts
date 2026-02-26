import type { Project } from '@vibe-forge/core'

import { fetchApiJson, jsonHeaders } from './base'

export async function listProjects(): Promise<{ projects: Project[] }> {
  return fetchApiJson<{ projects: Project[] }>('/api/projects')
}

export async function createProject(name?: string): Promise<{ project: Project }> {
  return fetchApiJson<{ project: Project }>('/api/projects', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ name })
  })
}
