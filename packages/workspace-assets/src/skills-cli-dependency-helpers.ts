import { access, copyFile, lstat, mkdir, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import { withDirectoryInstallLock } from '@vibe-forge/utils/install-lock'
import { resolveProjectSharedCachePath } from '@vibe-forge/utils/project-cache-path'
import { toSkillSlug } from '@vibe-forge/utils/skills-cli'

const toCacheSegment = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'default'
)

export const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

export const withInstallLock = async <T>(lockDir: string, callback: () => Promise<T>) => {
  try {
    return await withDirectoryInstallLock({ lockDir }, callback)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      message.replace('Timed out waiting for install lock', 'Timed out waiting for skill dependency install lock')
    )
  }
}

export const copyRegularFiles = async (sourceDir: string, targetDir: string) => {
  let fileCount = 0
  const entries = await readdir(sourceDir, { withFileTypes: true })

  await mkdir(targetDir, { recursive: true })

  for (const entry of entries) {
    const sourcePath = resolve(sourceDir, entry.name)
    const targetPath = resolve(targetDir, entry.name)
    const stat = await lstat(sourcePath)

    if (stat.isDirectory()) {
      fileCount += await copyRegularFiles(sourcePath, targetPath)
      continue
    }

    if (!stat.isFile()) continue

    await mkdir(dirname(targetPath), { recursive: true })
    await copyFile(sourcePath, targetPath)
    fileCount += 1
  }

  return fileCount
}

export const pickSearchResult = <T extends { skill: string }>(
  results: T[],
  name: string
) => {
  const slug = toSkillSlug(name)
  return results.find(result => (
    result.skill === name ||
    toSkillSlug(result.skill) === slug
  )) ?? results[0]
}

export const buildInstallDir = (params: {
  cwd: string
  registry?: string
  skill: string
  source: string
  version?: string
}) => {
  const registry = params.registry ?? 'default'
  return resolveProjectSharedCachePath(
    params.cwd,
    process.env,
    'skill-dependencies',
    'skills-cli',
    toCacheSegment('skills'),
    toCacheSegment('latest'),
    toCacheSegment(registry),
    ...params.source.split('/').map(toCacheSegment),
    toCacheSegment(params.version ?? 'latest'),
    toCacheSegment(params.skill)
  )
}
