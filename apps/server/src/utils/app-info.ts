import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cwd, env as processEnv } from 'node:process'

export interface ServerAppInfo {
  version?: string
  lastReleaseAt?: string
}

const readPackageInfo = async (packageJsonPath: string): Promise<ServerAppInfo | undefined> => {
  try {
    const content = await readFile(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content) as { version?: string; lastReleaseAt?: string; releaseDate?: string }
    return {
      version: pkg.version,
      lastReleaseAt: pkg.lastReleaseAt ?? pkg.releaseDate
    }
  } catch {
    return undefined
  }
}

export const getServerAppInfo = async (): Promise<ServerAppInfo> => {
  const packageDir = processEnv.__VF_PROJECT_PACKAGE_DIR__?.trim()
  const candidates = [
    packageDir != null && packageDir !== '' ? resolve(packageDir, 'package.json') : undefined,
    resolve(cwd(), 'apps/server/package.json'),
    resolve(cwd(), 'package.json')
  ].filter((item): item is string => item != null)

  for (const candidate of candidates) {
    const info = await readPackageInfo(candidate)
    if (info != null) return info
  }

  return {}
}
