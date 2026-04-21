let packageJson: Record<string, unknown> | undefined

const getPackageJson = () => {
  if (!packageJson) {
    try {
      // eslint-disable-next-line ts/no-require-imports
      packageJson = require('@vibe-forge/bootstrap/package.json') as Record<string, unknown>
    } catch {
      packageJson = {}
    }
  }

  return packageJson
}

export const getBootstrapPackageConfig = (key: string, defaultValue = '') => {
  const value = getPackageJson()[key]
  return typeof value === 'string' ? value : defaultValue
}

export const getBootstrapVersion = () => getBootstrapPackageConfig('version', '0.0.0')

export const getBootstrapDescription = () => getBootstrapPackageConfig('description', 'Vibe Forge bootstrap launcher')
