import type { ConfigSource } from '@vibe-forge/core'
import type { ConfigResponse, ConfigSchemaResponse } from '@vibe-forge/types'

import { fetchApiJson, fetchApiJsonOrThrow, jsonHeaders } from './base'
import type { ApiOkResponse } from './types'

export async function getConfig(): Promise<ConfigResponse> {
  return fetchApiJson<ConfigResponse>('/api/config')
}

export async function getConfigSchema(): Promise<ConfigSchemaResponse> {
  return fetchApiJson<ConfigSchemaResponse>('/api/config/schema')
}

export async function updateConfig(
  source: ConfigSource,
  section: string,
  value: unknown
): Promise<ApiOkResponse> {
  return fetchApiJsonOrThrow<ApiOkResponse>(
    '/api/config',
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ source, section, value })
    },
    '[api] update config failed:'
  )
}
