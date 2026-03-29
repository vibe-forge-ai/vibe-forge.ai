import type { AdapterQueryOptions } from '@vibe-forge/types'

export const resolveOpenCodeAgent = (params: {
  agent?: string
  planAgent?: string | false
  permissionMode?: AdapterQueryOptions['permissionMode']
}) => {
  if (params.permissionMode !== 'plan') return params.agent
  if (params.planAgent === false) return params.agent
  return params.planAgent ?? params.agent ?? 'plan'
}
