const unwrapAdapterToolName = (name: string) => {
  let next = name.trim()
  while (next.startsWith('adapter:')) {
    const stripped = next.split(':').slice(2).join(':').trim()
    if (stripped === '' || stripped === next) {
      break
    }
    next = stripped
  }
  return next
}

export const normalizeToolDisplayName = (name: string) => {
  const strippedAdapter = unwrapAdapterToolName(name)
  if (strippedAdapter.startsWith('mcp__')) {
    const parts = strippedAdapter.split('__').filter(Boolean)
    return parts.at(-1) ?? strippedAdapter
  }
  return strippedAdapter
}
