let packageJson: Record<string, unknown> | undefined

const getPackageJson = () => {
  if (!packageJson) {
    try {
      // eslint-disable-next-line ts/no-require-imports
      packageJson = require('@vibe-forge/mcp/package.json') as Record<string, unknown>
    } catch {
      packageJson = {}
    }
  }
  return packageJson
}

export const getPackageConfig = (key: string, defaultValue = '') => {
  const value = getPackageJson()[key]
  return typeof value === 'string' ? value : defaultValue
}

export const getMcpVersion = () => getPackageConfig('version', '0.0.0')

export const getMcpDescription = () => getPackageConfig('description', 'Vibe Forge MCP')
