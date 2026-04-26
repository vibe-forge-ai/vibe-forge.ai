/* eslint-disable max-lines -- Standalone background worker avoids booting the TS loader on the startup path. */
const { Buffer } = require('node:buffer')
const { spawn } = require('node:child_process')
const { createHash } = require('node:crypto')
const { existsSync } = require('node:fs')
const { access, mkdir, readFile, rename, rm, stat, writeFile } = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const process = require('node:process')

const DEFAULT_PACKAGE_TAG = 'latest'
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const STALE_LOCK_MS = 5 * 60 * 1000

const resolveRealHomeDir = () => {
  const realHome = process.env.__VF_PROJECT_REAL_HOME__?.trim() || process.env.HOME?.trim()
  return realHome || os.homedir()
}

const resolveBootstrapDataDir = () => path.join(resolveRealHomeDir(), '.vibe-forge', 'bootstrap')

const sanitizePackageName = packageName => packageName.replace(/^@/, '').replace(/[\\/]/g, '__')

const splitPackageName = packageName => packageName.split('/')

const hashValue = value => createHash('sha1').update(value).digest('hex')

const resolvePackageTag = () => process.env.VF_BOOTSTRAP_PACKAGE_TAG?.trim() || DEFAULT_PACKAGE_TAG

const resolvePackageCacheDir = (packageName, version) => (
  path.join(resolveBootstrapDataDir(), 'npm', sanitizePackageName(packageName), version)
)

const resolvePackageInstallDir = (cacheDir, packageName) => (
  path.join(cacheDir, 'node_modules', ...splitPackageName(packageName))
)

const resolveProjectNpmrc = () => {
  const projectNpmrc = path.resolve(process.cwd(), '.npmrc')
  return existsSync(projectNpmrc) ? projectNpmrc : undefined
}

const resolvePackageManagerEnv = () => {
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

const readOptionalFile = async filePath => {
  if (filePath == null || filePath === '') {
    return undefined
  }

  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return undefined
  }
}

const resolvePackageLookupKey = async packageName => {
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

const resolvePackageVersionMetadataPath = async packageName => {
  const lookupKey = await resolvePackageLookupKey(packageName)
  return {
    lookupKey,
    metadataPath: path.join(
      resolveBootstrapDataDir(),
      'npm-version-cache',
      `${sanitizePackageName(packageName)}-${hashValue(lookupKey)}.json`
    )
  }
}

const ensureDirectory = async targetPath => {
  await mkdir(targetPath, { recursive: true })
}

const isExistingPath = async targetPath => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const runBufferedCommand = async input => {
  const child = spawn(input.command, input.args, {
    cwd: input.cwd,
    env: input.env,
    stdio: input.stdio ?? 'pipe'
  })

  let stdout = ''
  let stderr = ''

  if (input.stdio !== 'inherit') {
    child.stdout?.on('data', chunk => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', chunk => {
      stderr += String(chunk)
    })
  }

  return await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => {
      resolve({
        code: code ?? 0,
        stderr,
        stdout
      })
    })
  })
}

const parseVersionOutput = (spec, stdout) => {
  const normalizedOutput = stdout.trim()
  if (!normalizedOutput) {
    throw new Error(`No version was returned for ${spec}.`)
  }

  try {
    const parsed = JSON.parse(normalizedOutput)
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

const resolvePublishedPackageVersion = async packageName => {
  const spec = `${packageName}@${resolvePackageTag()}`
  const result = await runBufferedCommand({
    command: NPM_BIN,
    args: ['view', spec, 'version', '--json'],
    env: resolvePackageManagerEnv()
  })

  if (result.code !== 0) {
    throw new Error(`Failed to resolve published version for ${spec}:\n${result.stderr.trim()}`)
  }

  return parseVersionOutput(spec, result.stdout)
}

const writePublishedPackageVersionMetadata = async (packageName, version) => {
  const { lookupKey, metadataPath } = await resolvePackageVersionMetadataPath(packageName)
  await ensureDirectory(path.dirname(metadataPath))

  const tempPath = `${metadataPath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(
    tempPath,
    `${JSON.stringify({
      lookupKey,
      packageName,
      packageTag: resolvePackageTag(),
      resolvedAt: new Date().toISOString(),
      version
    }, null, 2)}\n`,
    'utf8'
  )
  await rename(tempPath, metadataPath)
}

const readInstalledPackageVersion = async packageDir => {
  const packageJsonPath = path.join(packageDir, 'package.json')
  if (!(await isExistingPath(packageJsonPath))) {
    return undefined
  }

  try {
    const content = await readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(content)
    return typeof packageJson.version === 'string' ? packageJson.version : undefined
  } catch {
    return undefined
  }
}

const installPublishedPackage = async (packageName, version) => {
  const cacheDir = resolvePackageCacheDir(packageName, version)
  const packageDir = resolvePackageInstallDir(cacheDir, packageName)
  const installedVersion = await readInstalledPackageVersion(packageDir)
  if (installedVersion === version) {
    return
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
    stdio: 'ignore'
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
}

const acquireLock = async lockPath => {
  try {
    await mkdir(lockPath)
    return true
  } catch {
    try {
      const lockStat = await stat(lockPath)
      if (Date.now() - lockStat.mtimeMs > STALE_LOCK_MS) {
        await rm(lockPath, { force: true, recursive: true })
        await mkdir(lockPath)
        return true
      }
    } catch {
      return false
    }
  }

  return false
}

const decodePayload = () => {
  const rawPayload = process.argv[2]
  if (!rawPayload) {
    throw new Error('Missing refresh payload.')
  }

  const parsed = JSON.parse(Buffer.from(rawPayload, 'base64url').toString('utf8'))
  if (typeof parsed.packageName !== 'string' || parsed.packageName.trim() === '') {
    throw new Error('Invalid refresh payload.')
  }

  return {
    packageName: parsed.packageName
  }
}

const main = async () => {
  const { packageName } = decodePayload()
  const { metadataPath } = await resolvePackageVersionMetadataPath(packageName)
  const lockPath = `${metadataPath}.lock`
  if (!(await acquireLock(lockPath))) {
    return
  }

  try {
    const version = await resolvePublishedPackageVersion(packageName)
    await writePublishedPackageVersionMetadata(packageName, version)
    await installPublishedPackage(packageName, version)
  } finally {
    await rm(lockPath, { force: true, recursive: true })
  }
}

main().catch(() => {
  process.exitCode = 0
})
