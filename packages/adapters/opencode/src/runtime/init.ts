import { execFile } from 'node:child_process'
import { join } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

import type { AdapterCtx } from '@vibe-forge/types'
import { syncSymlinkTarget } from '@vibe-forge/utils'

import { resolveOpenCodeBinaryPath } from '#~/paths.js'
import { ensureOpenCodeNativeHooksInstalled } from './native-hooks'

const execFileAsync = promisify(execFile)

const ensureSymlink = async (sourcePath: string, targetPath: string) => {
  await syncSymlinkTarget({
    sourcePath,
    targetPath
  })
}

export const initOpenCodeAdapter = async (ctx: AdapterCtx) => {
  const binaryPath = resolveOpenCodeBinaryPath(ctx.env)

  try {
    await execFileAsync(binaryPath, ['--version'])
  } catch {
  }

  const realHome = process.env.__VF_PROJECT_REAL_HOME__
  const aiHome = process.env.HOME

  if (realHome && aiHome) {
    await ensureSymlink(
      join(realHome, '.local', 'share', 'opencode', 'auth.json'),
      join(aiHome, '.local', 'share', 'opencode', 'auth.json')
    )
    await ensureSymlink(
      join(realHome, '.local', 'share', 'opencode', 'mcp-auth.json'),
      join(aiHome, '.local', 'share', 'opencode', 'mcp-auth.json')
    )
  }
  await ensureOpenCodeNativeHooksInstalled(ctx)
}
