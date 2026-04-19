import { mkdir, readdir, rm } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import process from 'node:process'

import { DefinitionLoader } from '@vibe-forge/definition-loader'
import type { AdapterCtx, AdapterQueryOptions } from '@vibe-forge/types'
import { resolveProjectAiPath, syncSymlinkTarget } from '@vibe-forge/utils'

const filterResolvedSkills = async (
  cwd: string,
  selection: AdapterQueryOptions['skills']
) => {
  const loader = new DefinitionLoader(cwd)
  const allSkills = await loader.loadDefaultSkills()
  const include = selection?.include != null && selection.include.length > 0
    ? new Set(selection.include)
    : undefined
  const exclude = new Set(selection?.exclude ?? [])
  const result = new Map<string, string>()

  for (const skill of allSkills) {
    const name = basename(dirname(skill.path))
    if ((include != null && !include.has(name)) || exclude.has(name) || result.has(name)) continue
    result.set(name, dirname(skill.path))
  }

  return result
}

const ensureSymlinkTarget = async (sourcePath: string, targetPath: string) => {
  await syncSymlinkTarget({
    sourcePath,
    targetPath
  })
}

const mirrorDirectoryEntries = async (sourceDir: string, targetDir: string) => {
  try {
    const entries = await readdir(sourceDir, { withFileTypes: true })
    await mkdir(targetDir, { recursive: true })
    for (const entry of entries) {
      await ensureSymlinkTarget(resolve(sourceDir, entry.name), resolve(targetDir, entry.name))
    }
  } catch {
  }
}

export const ensureOpenCodeConfigDir = async (params: {
  ctx: AdapterCtx
  options: AdapterQueryOptions
}) => {
  const baseConfigDir = params.ctx.env.OPENCODE_CONFIG_DIR ?? process.env.OPENCODE_CONFIG_DIR ?? undefined
  const planOverlays = params.options.assetPlan?.overlays ?? []
  const resolvedSkills = planOverlays.length > 0
    ? new Map(
      planOverlays
        .filter((entry) => entry.kind === 'skill')
        .map((entry) => [basename(entry.targetPath), entry.sourcePath] as const)
    )
    : await filterResolvedSkills(params.ctx.cwd, params.options.skills)
  if (baseConfigDir == null && resolvedSkills.size === 0 && planOverlays.length === 0) return undefined

  const configDir = resolve(
    resolveProjectAiPath(params.ctx.cwd, params.ctx.env, '.mock', '.opencode-adapter'),
    params.options.sessionId,
    'config-dir'
  )
  await rm(configDir, { recursive: true, force: true })
  await mkdir(configDir, { recursive: true })

  if (baseConfigDir) {
    for (const folderName of ['agents', 'commands', 'modes', 'plugins']) {
      await ensureSymlinkTarget(resolve(baseConfigDir, folderName), resolve(configDir, folderName)).catch(() =>
        undefined
      )
    }
    for (const fileName of ['opencode.json', 'package.json', 'bun.lock', 'bun.lockb']) {
      await ensureSymlinkTarget(resolve(baseConfigDir, fileName), resolve(configDir, fileName)).catch(() => undefined)
    }
    await mirrorDirectoryEntries(resolve(baseConfigDir, 'skills'), resolve(configDir, 'skills'))
  }

  for (const [name, sourceDir] of resolvedSkills.entries()) {
    await ensureSymlinkTarget(sourceDir, resolve(configDir, 'skills', name))
  }

  for (const overlay of planOverlays.filter((entry) => entry.kind !== 'skill')) {
    await ensureSymlinkTarget(overlay.sourcePath, resolve(configDir, overlay.targetPath))
  }

  return configDir
}
