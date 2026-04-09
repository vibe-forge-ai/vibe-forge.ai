import { access, mkdir, rm, symlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { resolveMockHome } from '@vibe-forge/hooks'
import type { AdapterCtx } from '@vibe-forge/types'

import { ensureClaudeNativeHooksInstalled } from '../hooks/native'

const syncClaudeMockHomeSkills = async (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => {
  const sourceDir = resolve(ctx.cwd, '.ai', 'skills')
  const targetDir = resolve(resolveMockHome(ctx.cwd, ctx.env), '.claude', 'skills')

  try {
    await access(sourceDir)
  } catch {
    await rm(targetDir, { recursive: true, force: true })
    return
  }

  await rm(targetDir, { recursive: true, force: true })
  await mkdir(dirname(targetDir), { recursive: true })
  await symlink(sourceDir, targetDir, 'dir')
}

export const initClaudeCodeAdapter = async (ctx: AdapterCtx) => {
  await syncClaudeMockHomeSkills(ctx)
  await ensureClaudeNativeHooksInstalled(ctx)
}
