const CLIENT_ID_SEPARATOR = '::'

export const toSyntheticClientId = (connectionKey: string, rawClientId: string) => (
  `${connectionKey}${CLIENT_ID_SEPARATOR}${encodeURIComponent(rawClientId)}`
)

export const parseSyntheticClientId = (
  value: string
): { connectionKey: string; rawClientId: string } | undefined => {
  const separatorIndex = value.indexOf(CLIENT_ID_SEPARATOR)
  if (separatorIndex <= 0) {
    return undefined
  }

  const connectionKey = value.slice(0, separatorIndex).trim()
  const rawClientId = value.slice(separatorIndex + CLIENT_ID_SEPARATOR.length).trim()
  if (connectionKey === '' || rawClientId === '') {
    return undefined
  }

  try {
    return {
      connectionKey,
      rawClientId: decodeURIComponent(rawClientId)
    }
  } catch {
    return undefined
  }
}
