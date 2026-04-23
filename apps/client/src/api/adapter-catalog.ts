import type { AdapterCatalogResponse } from '@vibe-forge/types'

import { fetchApiJson } from './base'

export async function getAdapterCatalog(): Promise<AdapterCatalogResponse> {
  return fetchApiJson<AdapterCatalogResponse>('/api/adapter-catalog')
}
