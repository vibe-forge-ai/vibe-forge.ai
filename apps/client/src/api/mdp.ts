import type { MdpSummaryResponse } from '@vibe-forge/types'

import { fetchApiJson } from './base'

export async function getMdpSummary(): Promise<MdpSummaryResponse> {
  return fetchApiJson<MdpSummaryResponse>('/api/mdp/summary')
}
