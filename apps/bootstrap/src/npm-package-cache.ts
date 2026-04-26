import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { resolveBootstrapDataDir, resolveRealHomeDir } from './paths'

const DEFAULT_PACKAGE_TAG = 'latest'
const DEFAULT_PACKAGE_LOOKUP_TIMEOUT_MS = 1_000

interface PublishedPackageVersionMetadata {
  lookupKey: string
  packageName: string
  packageTag: string
  resolvedAt: string
  version: string
}

export const ensureDirectory = async (targetPath: string) => {
  await mkdir(targetPath, { recursive: true })
}

export const sanitizePackageName = (packageName: string) => packageName.replace(/^@/, '').replace(/[\\/]/g, '__')

export const splitPackageName = (packageName: string) => packageName.split('/')

const hashValue = (value: string) => createHash('sha1').update(value).digest('hex')

export const resolvePackageTag = () => process.env.VF_BOOTSTRAP_PACKAGE_TAG?.trim() || DEFAULT_PACKAGE_TAG

export const resolvePackageLookupTimeoutMs = () => {
  const rawValue = process.env.VF_BOOTSTRAP_PACKAGE_LOOKUP_TIMEOUT_MS?.trim()
  if (!rawValue) {
    return DEFAULT_PACKAGE_LOOKUP_TIMEOUT_MS
  }

  const parsedValue = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_PACKAGE_LOOKUP_TIMEOUT_MS
}

export const resolvePackageCacheDir = (packageName: string, version: string) => (
  path.join(resolveBootstrapDataDir(), 'npm', sanitizePackageName(packageName), version)
)

export const resolvePackageInstallDir = (cacheDir: string, packageName: string) => (
  path.join(cacheDir, 'node_modules', ...splitPackageName(packageName))
)

const resolvePackageVersionMetadataDir = () => path.join(resolveBootstrapDataDir(), 'npm-version-cache')

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
    npm_config_replace_registry_host: 'never',
    npm_config_update_notifier: 'false',
    NPM_CONFIG_REPLACE_REGISTRY_HOST: 'never',
    ...(userConfig != null
      ? {
        NPM_CONFIG_USERCONFIG: userConfig,
        npm_config_userconfig: userConfig
      }
      : {})
  }
}

const readOptionalFile = async (filePath: string | undefined) => {
  if (filePath == null || filePath === '') {
    return undefined
  }

  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return undefined
  }
}

const resolvePackageLookupKey = async (packageName: string) => {
  const env = resolvePackageManagerEnv()
  const userConfig = env.npm_config_userconfig ?? env.NPM_CONFIG_USERCONFIG
  const userConfigContent = await readOptionalFile(userConfig)

  return JSON.stringify({
    packageName,
    packageTag: resolvePackageTag(),
    registry: env.npm_config_registry ?? env.NPM_CONFIG_REGISTRY ?? '',
    userConfig: userConfig ?? '',
    userConfigContentHash: userConfigContent == null ? '' : hashValue(userConfigContent)
  })
}

const resolvePackageVersionMetadataPath = async (packageName: string) => {
  const lookupKey = await resolvePackageLookupKey(packageName)
  return {
    lookupKey,
    metadataPath: path.join(
      resolvePackageVersionMetadataDir(),
      `${sanitizePackageName(packageName)}-${hashValue(lookupKey)}.json`
    )
  }
}

export const readPublishedPackageVersionMetadata = async (packageName: string) => {
  const { lookupKey, metadataPath } = await resolvePackageVersionMetadataPath(packageName)

  try {
    const content = await readFile(metadataPath, 'utf8')
    const parsed = JSON.parse(content) as Partial<PublishedPackageVersionMetadata>
    if (
      parsed.lookupKey === lookupKey
      && parsed.packageName === packageName
      && parsed.packageTag === resolvePackageTag()
      && typeof parsed.version === 'string'
      && parsed.version.trim()
    ) {
      return {
        metadataPath,
        version: parsed.version.trim()
      }
    }
  } catch {
    // Ignore missing or invalid metadata and use the registry path.
  }

  return undefined
}

export const writePublishedPackageVersionMetadata = async (packageName: string, version: string) => {
  const { lookupKey, metadataPath } = await resolvePackageVersionMetadataPath(packageName)
  await ensureDirectory(path.dirname(metadataPath))

  const tempPath = `${metadataPath}.${process.pid}.${Date.now()}.tmp`
  const metadata: PublishedPackageVersionMetadata = {
    lookupKey,
    packageName,
    packageTag: resolvePackageTag(),
    resolvedAt: new Date().toISOString(),
    version
  }
  await writeFile(tempPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
  await rename(tempPath, metadataPath)
}

export const isExistingPath = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}
