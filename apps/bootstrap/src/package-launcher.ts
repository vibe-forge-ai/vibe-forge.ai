import { installPublishedPackage, resolvePackageBinEntrypoint, resolvePublishedPackageVersion } from './npm-package'
import { runNodeEntrypoint } from './process-utils'

export interface LaunchInstalledPackageOptions {
  commandName?: string
  forwardedArgs: string[]
  packageName: string
}

export const launchInstalledPackage = async (input: LaunchInstalledPackageOptions) => {
  const version = await resolvePublishedPackageVersion(input.packageName)
  console.error(`[bootstrap] using ${input.packageName}@${version}`)
  const installedPackage = await installPublishedPackage(input.packageName, version)
  const entryPath = await resolvePackageBinEntrypoint(installedPackage.packageDir, input.commandName)
  return await runNodeEntrypoint(entryPath, input.forwardedArgs)
}
