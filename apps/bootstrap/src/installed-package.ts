import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

interface PackageJsonWithBin {
  bin?: string | Record<string, string>
}

const requireFromInstalledPackage = createRequire(import.meta.url)

export const resolveInstalledPackageBin = (
  packageName: string,
  lookupBase: string,
  binName?: string
) => {
  const packageJsonPath = requireFromInstalledPackage.resolve(
    `${packageName}/package.json`,
    {
      paths: [lookupBase]
    }
  )
  const packageJson = requireFromInstalledPackage(packageJsonPath) as PackageJsonWithBin
  const { bin } = packageJson
  const binPath = typeof bin === 'string'
    ? bin
    : (
      typeof binName === 'string'
        ? bin?.[binName]
        : Object.values(bin ?? {}).find(
          (value): value is string => typeof value === 'string'
        )
    )

  if (typeof binPath !== 'string') {
    throw new TypeError(
      `Cannot resolve installed bin for package "${packageName}".`
    )
  }

  return resolve(dirname(packageJsonPath), binPath)
}
