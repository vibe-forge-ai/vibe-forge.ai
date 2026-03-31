import type { AdapterQueryOptions, Config } from '@vibe-forge/types'

const filterMcpServers = (
  mcpServers: Config['mcpServers'] | undefined,
  selection: AdapterQueryOptions['mcpServers']
) => {
  if (mcpServers == null) return {}

  const include = selection?.include != null && selection.include.length > 0
    ? new Set(selection.include)
    : undefined
  const exclude = new Set(selection?.exclude ?? [])

  return Object.fromEntries(
    Object.entries(mcpServers).filter(([name]) => (include == null || include.has(name)) && !exclude.has(name))
  )
}

export const mapMcpServersToOpenCode = (
  mcpServers: Config['mcpServers'] | undefined,
  selection: AdapterQueryOptions['mcpServers']
) => {
  const filtered = filterMcpServers(mcpServers, selection)
  const result: Record<string, Record<string, unknown>> = {}

  for (const [name, server] of Object.entries(filtered)) {
    if ('url' in server) {
      result[name] = {
        type: 'remote',
        url: server.url,
        enabled: server.enabled ?? true,
        ...(server.headers != null ? { headers: server.headers } : {})
      }
      continue
    }

    result[name] = {
      type: 'local',
      command: [server.command, ...server.args],
      enabled: server.enabled ?? true,
      ...(server.env != null ? { environment: server.env } : {})
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}
