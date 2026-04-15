import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import type { AdapterCtx } from '@vibe-forge/types'

import { resolveCopilotBinaryPath } from '#~/paths.js'
import { resolveAdapterConfig, toProcessEnv } from './shared'

const execFileAsync = promisify(execFile)

export const initCopilotAdapter = async (ctx: AdapterCtx) => {
  const adapterConfig = resolveAdapterConfig(ctx)
  const binaryPath = resolveCopilotBinaryPath(ctx.env, adapterConfig.cliPath)

  try {
    await execFileAsync(binaryPath, ['--version'], {
      cwd: ctx.cwd,
      env: toProcessEnv(ctx.env)
    })
  } catch {
  }
}
