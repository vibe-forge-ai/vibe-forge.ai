import type { SessionInfo } from '@vibe-forge/types'

export type SessionAssetDiagnostic = NonNullable<Extract<SessionInfo, { type: 'init' }>['assetDiagnostics']>[number]
export type SessionSelectionWarning = NonNullable<Extract<SessionInfo, { type: 'init' }>['selectionWarnings']>[number]

export interface SessionToolGroup {
  key: 'chrome-devtools' | 'system'
  labelKey: 'chat.toolGroupChromeDevtools' | 'chat.toolGroupSystem'
  icon: string
  tools: string[]
}

export const formatToolLabel = (tool: string) => {
  const parts = tool.split('__')
  return parts[parts.length - 1] || tool
}

export const getSessionToolGroups = (sessionInfo: SessionInfo | null): SessionToolGroup[] => {
  if (sessionInfo == null || sessionInfo.type !== 'init') {
    return []
  }

  return [
    {
      key: 'chrome-devtools',
      labelKey: 'chat.toolGroupChromeDevtools',
      icon: 'web_traffic',
      tools: sessionInfo.tools.filter((tool: string) => tool.startsWith('mcp__ChromeDevtools__'))
    },
    {
      key: 'system',
      labelKey: 'chat.toolGroupSystem',
      icon: 'memory',
      tools: sessionInfo.tools.filter((tool: string) => !tool.startsWith('mcp__ChromeDevtools__'))
    }
  ].filter((group): group is SessionToolGroup => group.tools.length > 0)
}

export const getSessionAssetWarnings = (sessionInfo: SessionInfo | null): SessionAssetDiagnostic[] => {
  if (sessionInfo == null || sessionInfo.type !== 'init') {
    return []
  }

  return (sessionInfo.assetDiagnostics ?? []).filter((diagnostic: SessionAssetDiagnostic) =>
    diagnostic.status === 'skipped'
  )
}

export const getSessionSelectionWarnings = (sessionInfo: SessionInfo | null): SessionSelectionWarning[] => {
  if (sessionInfo == null || sessionInfo.type !== 'init') {
    return []
  }

  return sessionInfo.selectionWarnings ?? []
}
