import { execFile } from 'node:child_process'

import type { ChatMessage } from '@vibe-forge/core'
import type { AdapterCtx } from '@vibe-forge/core/adapter'
import { uuid } from '@vibe-forge/core/utils/uuid'

export interface OpenCodeAdapterConfig {
  agent?: string
  planAgent?: string | false
  titlePrefix?: string
  share?: boolean
  sessionListMaxCount?: number
  configContent?: Record<string, unknown>
}

export interface OpenCodeRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

export const execFileAsync = (
  file: string,
  args: string[],
  options: { cwd: string; env: Record<string, string>; maxBuffer: number }
) => new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
  execFile(file, args, options, (error, stdout, stderr) => {
    if (error) {
      reject(error)
      return
    }
    resolve({ stdout: String(stdout), stderr: String(stderr) })
  })
})

export const stripAnsi = (value: string) => value.replaceAll(/\u001B\[[0-9;]*[A-Za-z]/g, '')

export const createAssistantMessage = (content: string, model?: string): ChatMessage => ({
  id: uuid(),
  role: 'assistant',
  content,
  createdAt: Date.now(),
  ...(model != null ? { model } : {})
})

export const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error ?? 'OpenCode session failed unexpectedly')
)

export const toProcessEnv = (env: Record<string, string | null | undefined>) => (
  Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
)

export const resolveAdapterConfig = (ctx: AdapterCtx): OpenCodeAdapterConfig => {
  const [config, userConfig] = ctx.configs
  return {
    ...(config?.adapters?.opencode ?? {}),
    ...(userConfig?.adapters?.opencode ?? {})
  }
}
