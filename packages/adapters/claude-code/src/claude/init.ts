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

const syncClaudeMockHomeSkills = async (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => {
  await syncClaudeMockHomeSymlink({
    sourcePath: resolve(ctx.cwd, '.ai', 'skills'),
    targetPath: resolve(resolveMockHome(ctx.cwd, ctx.env), '.claude', 'skills'),
    type: 'dir'
  })
}

const syncClaudeMockHomeKeychains = async (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => {
  const realHome = ctx.env.__VF_PROJECT_REAL_HOME__?.trim() || process.env.__VF_PROJECT_REAL_HOME__?.trim()

  if (realHome == null || realHome === '') return

  await syncClaudeMockHomeSymlink({
    sourcePath: resolve(realHome, 'Library', 'Keychains'),
    targetPath: resolve(resolveMockHome(ctx.cwd, ctx.env), 'Library', 'Keychains'),
    type: 'dir'
  })
}

export const initClaudeCodeAdapter = async (ctx: AdapterCtx) => {
  await syncClaudeMockHomeSkills(ctx)
  await syncClaudeMockHomeKeychains(ctx)
  await ensureClaudeNativeHooksInstalled(ctx)
}
