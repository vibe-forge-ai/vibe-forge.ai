export function getCliVersion(): string {
  try {
    // eslint-disable-next-line ts/no-require-imports
    return require('@vibe-forge/cli/package.json').version
  } catch {
    return '0.0.0'
  }
}
