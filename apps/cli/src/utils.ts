let packageJson: Record<string, any> | undefined

function getPackageJson() {
  if (!packageJson) {
    try {
      // eslint-disable-next-line ts/no-require-imports
      packageJson = require('@vibe-forge/cli/package.json')
    } catch {
      packageJson = {}
    }
  }
  return packageJson!
}

export function getPackageConfig(key: string, defaultValue = ''): string {
  return getPackageJson()[key] ?? defaultValue
}

export function getCliVersion() {
  return getPackageConfig('version', '0.0.0')
}

export function getCliDescription() {
  return getPackageConfig('description', 'Vibe Forge CLI')
}
