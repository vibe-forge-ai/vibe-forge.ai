import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import { readJsonFileOrDefault, resolveMockHome, writeJsonFile } from '@vibe-forge/hooks'
import type { AdapterCtx } from '@vibe-forge/types'
import { resolveProjectAiPath, syncSymlinkTarget } from '@vibe-forge/utils'

import { ensureClaudeNativeHooksInstalled } from '../hooks/native'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const mergeRecord = (...values: unknown[]) => {
  const merged: Record<string, unknown> = {}
  for (const value of values) {
    if (!isRecord(value)) continue
    Object.assign(merged, value)
  }
  return merged
}

const syncClaudeMockHomeSymlink = async (params: {
  sourcePath: string
  targetPath: string
  type: 'dir' | 'file'
}) => {
  await syncSymlinkTarget({
    ...params,
    onMissingSource: 'remove'
  })
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
    sourcePath: resolveProjectAiPath(ctx.cwd, ctx.env, 'skills'),
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

const syncClaudeMockHomeProjectState = async (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => {
  const mockHome = resolveMockHome(ctx.cwd, ctx.env)
  const mockStatePath = resolve(mockHome, '.claude.json')
  const realHome = ctx.env.__VF_PROJECT_REAL_HOME__?.trim() || process.env.__VF_PROJECT_REAL_HOME__?.trim()
  const realStatePath = realHome != null && realHome !== ''
    ? resolve(realHome, '.claude.json')
    : undefined

  const mockState = await readJsonFileOrDefault<Record<string, unknown> | undefined>(mockStatePath, undefined)
  const realState = realStatePath != null
    ? await readJsonFileOrDefault<Record<string, unknown> | undefined>(realStatePath, undefined)
    : undefined
  const nextState = mergeRecord(mockState, realState)
  const realProjects = isRecord(realState?.projects) ? realState.projects : undefined
  const mockProjects = isRecord(mockState?.projects) ? mockState.projects : undefined
  const projects = mergeRecord(mockProjects, realProjects)
  const workspacePath = resolve(ctx.cwd)
  const existingProjectState = mergeRecord(
    isRecord(mockProjects?.[workspacePath]) ? mockProjects[workspacePath] : undefined,
    isRecord(realProjects?.[workspacePath]) ? realProjects[workspacePath] : undefined
  )
  const existingOnboardingCount = typeof existingProjectState.projectOnboardingSeenCount === 'number' &&
      Number.isFinite(existingProjectState.projectOnboardingSeenCount)
    ? existingProjectState.projectOnboardingSeenCount
    : 0

  projects[workspacePath] = {
    ...existingProjectState,
    hasTrustDialogAccepted: true,
    projectOnboardingSeenCount: Math.max(existingOnboardingCount, 1),
    hasCompletedProjectOnboarding: true
  }
  nextState.projects = projects

  await writeJsonFile(mockStatePath, nextState)
}

export const initClaudeCodeAdapter = async (ctx: AdapterCtx) => {
  await syncClaudeMockHomeSkills(ctx)
  await syncClaudeMockHomeKeychains(ctx)
  await syncClaudeMockHomeProjectState(ctx)
  await ensureClaudeNativeHooksInstalled(ctx)
}
