import { existsSync } from 'node:fs'
import { access, mkdir, readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { resolveBootstrapDataDir, resolveRealHomeDir } from './paths'
import { runBufferedCommand } from './process-utils'

const DEFAULT_PACKAGE_TAG = process.env.VF_BOOTSTRAP_PACKAGE_TAG?.trim() || 'latest'
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm'

interface InstalledPackageInfo {
  packageDir: string
  version: string
}

const ensureDirectory = async (targetPath: string) => {
  await mkdir(targetPath, { recursive: true })
}

const sanitizePackageName = (packageName: string) => packageName.replace(/^@/, '').replace(/[\\/]/g, '__')

const splitPackageName = (packageName: string) => packageName.split('/')

const resolvePackageCacheDir = (packageName: string, version: string) => (
  path.join(resolveBootstrapDataDir(), 'npm', sanitizePackageName(packageName), version)
)

const resolvePackageInstallDir = (cacheDir: string, packageName: string) => (
  path.join(cacheDir, 'node_modules', ...splitPackageName(packageName))
)

const resolveProjectNpmrc = () => {
  const projectNpmrc = path.resolve(process.cwd(), '.npmrc')
  return existsSync(projectNpmrc) ? projectNpmrc : undefined
}

export const resolvePackageManagerEnv = () => {
  const userConfig = process.env.npm_config_userconfig ?? process.env.NPM_CONFIG_USERCONFIG ?? resolveProjectNpmrc()

  return {
    ...process.env,
    HOME: resolveRealHomeDir(),
    USERPROFILE: resolveRealHomeDir(),
    npm_config_cache: path.join(resolveBootstrapDataDir(), 'npm-cache'),
    npm_config_update_notifier: 'false',
    ...(userConfig != null
      ? {
          NPM_CONFIG_USERCONFIG: userConfig,
          npm_config_userconfig: userConfig
        }
      : {})
  }
}

const isExistingPath = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

export const resolvePublishedPackageVersion = async (packageName: string) => {
  const spec = `${packageName}@${DEFAULT_PACKAGE_TAG}`
  const result = await runBufferedCommand({
    command: NPM_BIN,
    args: ['view', spec, 'version', '--json'],
    env: resolvePackageManagerEnv()
  })

  if (result.code !== 0) {
    throw new Error(`Failed to resolve published version for ${spec}:\n${result.stderr.trim()}`)
  }

  const normalizedOutput = result.stdout.trim()
  if (!normalizedOutput) {
    throw new Error(`No version was returned for ${spec}.`)
  }

  try {
    const parsed = JSON.parse(normalizedOutput) as unknown
    if (typeof parsed === 'string' && parsed.trim()) {
      return parsed.trim()
    }
  } catch {
    // fall through
  }

  const unquotedOutput = normalizedOutput.replace(/^"|"$/g, '').trim()
  if (!unquotedOutput) {
    throw new Error(`Invalid published version for ${spec}: ${normalizedOutput}`)
  }

  return unquotedOutput
}

const readInstalledPackageVersion = async (packageDir: string) => {
  const packageJsonPath = path.join(packageDir, 'package.json')
  if (!(await isExistingPath(packageJsonPath))) {
    return undefined
  }

  try {
    const content = await readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(content) as { version?: unknown }
    return typeof packageJson.version === 'string' ? packageJson.version : undefined
  } catch {
    return undefined
  }
}

export const installPublishedPackage = async (packageName: string, version: string): Promise<InstalledPackageInfo> => {
  const cacheDir = resolvePackageCacheDir(packageName, version)
  const packageDir = resolvePackageInstallDir(cacheDir, packageName)
  const installedVersion = await readInstalledPackageVersion(packageDir)
  if (installedVersion === version) {
    return { packageDir, version }
  }

  const stagingDir = `${cacheDir}.tmp-${process.pid}-${Date.now()}`
  await rm(stagingDir, { recursive: true, force: true })
  await ensureDirectory(stagingDir)

  const result = await runBufferedCommand({
    command: NPM_BIN,
    args: [
      'install',
      '--prefix',
      stagingDir,
      '--no-audit',
      '--no-fund',
      '--loglevel=error',
      `${packageName}@${version}`
    ],
    env: resolvePackageManagerEnv(),
    stdio: 'inherit'
  })

  if (result.code !== 0) {
    await rm(stagingDir, { recursive: true, force: true })
    throw new Error(`Failed to install ${packageName}@${version}.`)
  }

  await ensureDirectory(path.dirname(cacheDir))
  await rm(cacheDir, { recursive: true, force: true })

  try {
    await rename(stagingDir, cacheDir)
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true })
    throw error
  }

  return {
    packageDir: resolvePackageInstallDir(cacheDir, packageName),
    version
  }
}

export const resolvePackageBinEntrypoint = async (packageDir: string, commandName?: string) => {
  const packageJsonContent = await readFile(path.join(packageDir, 'package.json'), 'utf8')
  const packageJson = JSON.parse(packageJsonContent) as { bin?: unknown }
  const { bin } = packageJson

  if (typeof bin === 'string') {
    return path.resolve(packageDir, bin)
  }

  if (bin == null || typeof bin !== 'object') {
    throw new Error(`Package ${packageDir} does not expose a CLI bin.`)
  }

  const binEntries = Object.entries(bin).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  if (binEntries.length === 0) {
    throw new Error(`Package ${packageDir} does not expose a CLI bin.`)
  }

  const matchedEntry = commandName != null
    ? binEntries.find(([binName]) => binName === commandName)
    : undefined

  return path.resolve(packageDir, (matchedEntry ?? binEntries[0])[1])
}
