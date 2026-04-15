import { execFile } from 'node:child_process'
import { access, mkdir, rm, symlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

import type { AdapterCtx } from '@vibe-forge/types'

import { resolveCopilotBinaryPath } from '#~/paths.js'
import { resolveAdapterConfig, toProcessEnv } from './shared'

const execFileAsync = promisify(execFile)

const resolveCopilotMockHome = (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => {
  const explicitHome = ctx.env.HOME?.trim() || process.env.HOME?.trim()
  return explicitHome ? resolve(explicitHome) : resolve(ctx.cwd, '.ai', '.mock')
}

const syncCopilotMockHomeSymlink = async (params: {
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

const syncCopilotMockHomeKeychains = async (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => {
  const realHome = ctx.env.__VF_PROJECT_REAL_HOME__?.trim() || process.env.__VF_PROJECT_REAL_HOME__?.trim()
  const targetPath = resolve(resolveCopilotMockHome(ctx), 'Library', 'Keychains')

  if (realHome == null || realHome === '') {
    await rm(targetPath, { recursive: true, force: true })
    return
  }

  await syncCopilotMockHomeSymlink({
    sourcePath: resolve(realHome, 'Library', 'Keychains'),
    targetPath,
    type: 'dir'
  })
}

export const initCopilotAdapter = async (ctx: AdapterCtx) => {
  const adapterConfig = resolveAdapterConfig(ctx)
  const binaryPath = resolveCopilotBinaryPath(ctx.env, adapterConfig.cliPath)

  await syncCopilotMockHomeKeychains(ctx)

  try {
    await execFileAsync(binaryPath, ['--version'], {
      cwd: ctx.cwd,
      env: toProcessEnv(ctx.env)
    })
  } catch {
  }
}
