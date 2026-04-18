import { execFile } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
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

const resolveGeminiManagedSkills = (ctx: Pick<AdapterCtx, 'assets'>) => {
  const result = new Map<string, string>()
  for (const asset of ctx.assets?.skills ?? []) {
    const targetName = asset.displayName.replaceAll('/', '__')
    if (targetName === '' || result.has(targetName)) continue
    result.set(targetName, dirname(asset.sourcePath))
  }
  return result
}

const syncGeminiMockHomeSkillEntries = async (ctx: Pick<AdapterCtx, 'assets' | 'cwd' | 'env'>) => {
  const managedSkills = resolveGeminiManagedSkills(ctx)
  if (managedSkills.size === 0) {
    await syncGeminiMockHomeSkills(ctx)
    return
  }

  const targetDir = resolve(resolveGeminiMockHome(ctx), '.agents', 'skills')
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })

  for (const [targetName, sourcePath] of managedSkills.entries()) {
    await syncGeminiMockHomeSymlink({
      sourcePath,
      targetPath: resolve(targetDir, targetName)
    })
  }
}

export const initGeminiAdapter = async (ctx: AdapterCtx) => {
  prepareGeminiNativeHooks(ctx)

  const binaryPath = resolveGeminiBinaryPath(ctx.env)

  try {
    await execFileAsync(binaryPath, ['--version'])
  } catch {
  }

  await mkdir(resolve(resolveGeminiMockHome(ctx), '.gemini'), { recursive: true })
  await syncGeminiMockHomeSkillEntries(ctx)
}
