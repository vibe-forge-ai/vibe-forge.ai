import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

import {
  readPublishedPackageVersionMetadata,
  resolvePackageLookupTimeoutMs,
  resolvePackageManagerEnv,
  resolvePackageTag,
  writePublishedPackageVersionMetadata
} from './npm-package-cache'
import { runBufferedCommand } from './process-utils'

const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm'

export { resolvePackageManagerEnv } from './npm-package-cache'
export { installPublishedPackage, resolvePackageBinEntrypoint } from './npm-package-install'

const resolveRefreshWorkerEntrypoint = () => {
  const requireFromHere = createRequire(import.meta.url)
  const packageJsonPath = requireFromHere.resolve('@vibe-forge/bootstrap/package.json')
  return path.join(path.dirname(packageJsonPath), 'package-version-refresh-worker.cjs')
}

const spawnPackageVersionRefresh = (packageName: string) => {
  if (process.env.VF_BOOTSTRAP_DISABLE_BACKGROUND_REFRESH === '1') {
    return
  }

  try {
    const payload = Buffer.from(JSON.stringify({ packageName }), 'utf8').toString('base64url')
    const child = spawn(
      process.execPath,
      [
        resolveRefreshWorkerEntrypoint(),
        payload
      ],
      {
        cwd: process.cwd(),
        detached: true,
        env: resolvePackageManagerEnv(),
        stdio: 'ignore'
      }
    )
    child.unref()
  } catch {
    // Keep bootstrap startup independent from background metadata refresh.
  }
}

const resolvePublishedPackageVersionFromRegistry = async (
  packageName: string,
  options: { timeoutMs?: number } = {}
) => {
  const spec = `${packageName}@${resolvePackageTag()}`
  const result = await runBufferedCommand({
    command: NPM_BIN,
    args: ['view', spec, 'version', '--json'],
    env: resolvePackageManagerEnv(),
    timeoutMs: options.timeoutMs
  })

  if (result.timedOut === true) {
    return {
      spec,
      timedOut: true as const
    }
  }

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
      return {
        spec,
        version: parsed.trim()
      }
    }
  } catch {
    // fall through
  }

  const unquotedOutput = normalizedOutput.replace(/^"|"$/g, '').trim()
  if (!unquotedOutput) {
    throw new Error(`Invalid published version for ${spec}: ${normalizedOutput}`)
  }

  return {
    spec,
    version: unquotedOutput
  }
}

export const resolvePublishedPackageVersion = async (packageName: string) => {
  const cachedMetadata = await readPublishedPackageVersionMetadata(packageName)
  const registryResult = await resolvePublishedPackageVersionFromRegistry(
    packageName,
    cachedMetadata == null
      ? {}
      : {
        timeoutMs: resolvePackageLookupTimeoutMs()
      }
  )

  if ('version' in registryResult) {
    await writePublishedPackageVersionMetadata(packageName, registryResult.version)
    return registryResult.version
  }

  if (cachedMetadata == null) {
    // This is not expected because uncached lookups do not use a timeout.
    const retryResult = await resolvePublishedPackageVersionFromRegistry(packageName)
    if ('version' in retryResult) {
      await writePublishedPackageVersionMetadata(packageName, retryResult.version)
      return retryResult.version
    }
    throw new Error(`Failed to resolve published version for ${retryResult.spec}.`)
  }

  console.error(
    `[bootstrap] npm view ${registryResult.spec} timed out after ${resolvePackageLookupTimeoutMs()}ms, using cached ${packageName}@${cachedMetadata.version}`
  )
  spawnPackageVersionRefresh(packageName)
  return cachedMetadata.version
}
