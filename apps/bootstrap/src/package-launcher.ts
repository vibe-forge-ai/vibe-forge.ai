import process from 'node:process'

import { logBootstrapDebug } from './debug'
import { resolveInstalledPackageBin } from './installed-package'
import { installPublishedPackage, resolvePackageBinEntrypoint, resolvePublishedPackageVersion } from './npm-package'
import { runNodeEntrypoint } from './process-utils'

export interface LaunchInstalledPackageOptions {
  commandName?: string
  forwardedArgs: string[]
  packageName: string
}

const resolveLookupBase = () => {
  const value = process.env.VF_BOOTSTRAP_PACKAGE_LOOKUP_BASE?.trim()
  return value === '' ? undefined : value
}

export const launchInstalledPackage = async (input: LaunchInstalledPackageOptions) => {
  const lookupBase = resolveLookupBase()
  if (lookupBase != null) {
    try {
      const localEntryPath = resolveInstalledPackageBin(
        input.packageName,
        lookupBase,
        input.commandName
      )
      logBootstrapDebug(`[bootstrap] using installed ${input.packageName} from ${lookupBase}`)
      return await runNodeEntrypoint(localEntryPath, input.forwardedArgs)
    } catch {
      // Fall through to the published package cache path.
    }
  }

  const version = await resolvePublishedPackageVersion(input.packageName)
  logBootstrapDebug(`[bootstrap] using ${input.packageName}@${version}`)
  const installedPackage = await installPublishedPackage(input.packageName, version)
  const entryPath = await resolvePackageBinEntrypoint(installedPackage.packageDir, input.commandName)
  return await runNodeEntrypoint(entryPath, input.forwardedArgs)
}
