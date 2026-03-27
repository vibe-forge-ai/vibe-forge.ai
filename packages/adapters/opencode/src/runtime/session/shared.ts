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

interface OpenCodeJsonLineEvent {
  type?: string
  part?: {
    text?: string
  }
}

const stripAnsiSequences = (value: string) => {
  let output = ''
  let index = 0

  while (index < value.length) {
    if (value.charCodeAt(index) === 27 && value[index + 1] === '[') {
      index += 2
      while (index < value.length) {
        const code = value.charCodeAt(index)
        if (code >= 64 && code <= 126) {
          index += 1
          break
        }
        index += 1
      }
      continue
    }

    output += value[index]
    index += 1
  }

  return output
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

export const stripAnsi = (value: string) => stripAnsiSequences(value)

export const createAssistantMessage = (content: string, model?: string): ChatMessage => ({
  id: uuid(),
  role: 'assistant',
  content,
  createdAt: Date.now(),
  ...(model != null ? { model } : {})
})

export const extractTextFromOpenCodeJsonEvents = (stdout: string) => {
  const textParts: string[] = []

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('{') || !line.endsWith('}')) continue

    try {
      const event = JSON.parse(line) as OpenCodeJsonLineEvent
      if (event.type === 'text' && typeof event.part?.text === 'string') {
        textParts.push(event.part.text)
      }
    } catch {
    }
  }

  return textParts.join('')
}

export const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error ?? 'OpenCode session failed unexpectedly')
)

export const toAdapterErrorData = (
  error: unknown,
  overrides: Partial<{ message: string; code: string; details: unknown; fatal: boolean }> = {}
) => ({
  message: overrides.message ?? getErrorMessage(error),
  ...(overrides.code != null ? { code: overrides.code } : {}),
  ...(overrides.details !== undefined ? { details: overrides.details } : {}),
  fatal: overrides.fatal ?? true
})

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
