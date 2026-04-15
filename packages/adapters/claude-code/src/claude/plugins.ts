import { cp, mkdir, rm, symlink } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'

import { resolveProjectAiPath } from '@vibe-forge/utils'
import { listManagedPluginInstalls } from '@vibe-forge/utils/managed-plugin'

const toSlug = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'plugin'
)

const linkOrCopyDirectory = async (sourceDir: string, targetDir: string) => {
  try {
    await symlink(sourceDir, targetDir, 'dir')
  } catch {
    await cp(sourceDir, targetDir, { recursive: true })
  }
}

export const stageClaudePluginDirs = async (params: {
  cwd: string
  ctxId: string
  sessionId: string
}) => {
  const installs = await listManagedPluginInstalls(params.cwd, { adapter: 'claude' })
  if (installs.length === 0) return []

  const runtimeRoot = resolveProjectAiPath(
    params.cwd,
    process.env,
    'caches',
    params.ctxId,
    params.sessionId,
    '.claude-plugins'
  )
  await rm(runtimeRoot, { recursive: true, force: true })
  await mkdir(runtimeRoot, { recursive: true })

  const pluginDirs: string[] = []
  for (const install of installs) {
    const targetDir = resolve(runtimeRoot, `${toSlug(install.config.name)}-${basename(install.installDir)}`)
    await linkOrCopyDirectory(install.nativePluginDir, targetDir)
    pluginDirs.push(targetDir)
  }

  return pluginDirs
}
