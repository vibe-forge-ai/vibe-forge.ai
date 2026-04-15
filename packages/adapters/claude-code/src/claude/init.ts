import { access, mkdir, rm, symlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import { resolveMockHome } from '@vibe-forge/hooks'
import type { AdapterCtx } from '@vibe-forge/types'

import { ensureClaudeNativeHooksInstalled } from '../hooks/native'

const syncClaudeMockHomeSymlink = async (params: {
  sourcePath: string
  targetPath: string
  type: 'dir' | 'file'
}) => {
  const { sourcePath, targetPath, type } = params

  try {
    await access(sourcePath)
  } catch {
    await rm(targetPath, { recursive: true, force: true })
    return
  }

  if (resolve(sourcePath) === resolve(targetPath)) return

  await rm(targetPath, { recursive: true, force: true })
  await mkdir(dirname(targetPath), { recursive: true })
  await symlink(sourcePath, targetPath, type)
}

const resolveClaudeManagedSkills = (ctx: Pick<AdapterCtx, 'assets'>) => {
  const result = new Map<string, string>()
  for (const asset of ctx.assets?.skills ?? []) {
    const targetName = asset.displayName.replaceAll('/', '__')
    if (targetName === '' || result.has(targetName)) continue
    result.set(targetName, dirname(asset.sourcePath))
  }
  return result
}

const syncClaudeMockHomeSkillEntries = async (params: {
  ctx: Pick<AdapterCtx, 'cwd' | 'env'>
  skills: Map<string, string>
}) => {
  const targetDir = resolve(resolveMockHome(params.ctx.cwd, params.ctx.env), '.claude', 'skills')
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })

  for (const [targetName, sourcePath] of params.skills.entries()) {
    await syncClaudeMockHomeSymlink({
      sourcePath,
      targetPath: resolve(targetDir, targetName),
      type: 'dir'
    })
  }
}

const syncClaudeMockHomeSkills = async (ctx: Pick<AdapterCtx, 'assets' | 'cwd' | 'env'>) => {
  const managedSkills = resolveClaudeManagedSkills(ctx)
  if (managedSkills.size > 0) {
    await syncClaudeMockHomeSkillEntries({
      ctx,
      skills: managedSkills
    })
    return
  }

  await syncClaudeMockHomeSymlink({
    sourcePath: resolve(ctx.cwd, '.ai', 'skills'),
    targetPath: resolve(resolveMockHome(ctx.cwd, ctx.env), '.claude', 'skills'),
    type: 'dir'
  })
}

const syncClaudeMockHomeKeychains = async (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => {
  const realHome = ctx.env.__VF_PROJECT_REAL_HOME__?.trim() || process.env.__VF_PROJECT_REAL_HOME__?.trim()
  const targetPath = resolve(resolveMockHome(ctx.cwd, ctx.env), 'Library', 'Keychains')

  if (realHome == null || realHome === '') {
    await rm(targetPath, { recursive: true, force: true })
    return
  }

  await syncClaudeMockHomeSymlink({
    sourcePath: resolve(realHome, 'Library', 'Keychains'),
    targetPath,
    type: 'dir'
  })
}

export const initClaudeCodeAdapter = async (ctx: AdapterCtx) => {
  await syncClaudeMockHomeSkills(ctx)
  await syncClaudeMockHomeKeychains(ctx)
  await ensureClaudeNativeHooksInstalled(ctx)
}
