let packageJson: Record<string, unknown> | undefined

const getPackageJson = () => {
  if (!packageJson) {
    try {
      // eslint-disable-next-line ts/no-require-imports
      packageJson = require('@vibe-forge/web/package.json') as Record<string, unknown>
    } catch {
      packageJson = {}
    }
  }

  return packageJson
}

export const getWebPackageConfig = (key: string, defaultValue = '') => {
  const value = getPackageJson()[key]
  return typeof value === 'string' ? value : defaultValue
}

export const getWebVersion = () => getWebPackageConfig('version', '0.0.0')

export const getWebDescription = () => getWebPackageConfig('description', 'Vibe Forge integrated web app')
