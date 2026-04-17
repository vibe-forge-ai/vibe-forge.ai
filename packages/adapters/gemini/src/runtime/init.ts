import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

import type { AdapterCtx } from '@vibe-forge/types'

import { resolveGeminiBinaryPath } from '#~/paths.js'

import { prepareGeminiNativeHooks } from './native-hooks'
import { resolveGeminiMockHome, syncGeminiMockHomeSymlink } from './shared'

const execFileAsync = promisify(execFile)

const syncGeminiMockHomeSkills = async (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => {
  const mockHome = resolveGeminiMockHome(ctx)

  await syncGeminiMockHomeSymlink({
    sourcePath: resolve(ctx.cwd, '.ai', 'skills'),
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

  await mkdir(resolve(resolveGeminiMockHome(ctx), '.gemini'), { recursive: true })
  await syncGeminiMockHomeSkills(ctx)
}
