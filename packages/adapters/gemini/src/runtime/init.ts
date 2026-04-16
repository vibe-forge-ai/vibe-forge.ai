import { execFile } from 'node:child_process'
import { access, mkdir, rm, symlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

import { resolveMockHome } from '@vibe-forge/hooks'
import type { AdapterCtx } from '@vibe-forge/types'

import { resolveGeminiBinaryPath } from '#~/paths.js'

import { prepareGeminiNativeHooks } from './native-hooks'

const execFileAsync = promisify(execFile)

const syncMockHomeSymlink = async (params: {
  sourcePath: string
  targetPath: string
}) => {
  const { sourcePath, targetPath } = params

  try {
    await access(sourcePath)
  } catch {
    await rm(targetPath, { recursive: true, force: true })
    return
  }

  await rm(targetPath, { recursive: true, force: true })
  await mkdir(dirname(targetPath), { recursive: true })
  await symlink(sourcePath, targetPath, 'dir')
}

const syncGeminiMockHomeSkills = async (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => {
  const sourceDir = resolve(ctx.cwd, '.ai', 'skills')
  const mockHome = resolveMockHome(ctx.cwd, ctx.env)

  await syncMockHomeSymlink({
    sourcePath: sourceDir,
    targetPath: resolve(mockHome, '.agents', 'skills')
  })
}

export const initGeminiAdapter = async (ctx: AdapterCtx) => {
  prepareGeminiNativeHooks(ctx)

  const binaryPath = resolveGeminiBinaryPath(ctx.env)

  try {
    await execFileAsync(binaryPath, ['--version'])
  } catch {
  }

  await mkdir(resolve(resolveMockHome(ctx.cwd, ctx.env), '.gemini'), { recursive: true })
  await syncGeminiMockHomeSkills(ctx)
}
