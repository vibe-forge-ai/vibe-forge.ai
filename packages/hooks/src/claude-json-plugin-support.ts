import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'

import type { HookInput, HookInputs, HookOutputCore, HookOutputs } from './type'

export interface ClaudeCommandHookEntry {
  type?: string
  command?: string
}

export interface ClaudeCommandHookGroup {
  matcher?: string
  hooks?: ClaudeCommandHookEntry[]
}

export interface ClaudeHooksConfig {
  hooks?: Partial<Record<keyof HookInputs, ClaudeCommandHookGroup[]>>
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const toSnakeCase = (value: string) => value.replace(/[A-Z]/g, char => `_${char.toLowerCase()}`)

const toSnakeCaseRecord = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(item => toSnakeCaseRecord(item))
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [toSnakeCase(key), toSnakeCaseRecord(entryValue)])
  )
}

const mergeSystemMessage = (left: string | undefined, right: string | undefined) => {
  if (left == null || left.trim() === '') return right
  if (right == null || right.trim() === '') return left
  return `${left}\n${right}`
}

const mergeHookSpecificOutput = (left: unknown, right: unknown) => {
  if (!isRecord(left)) return right
  if (!isRecord(right)) return left
  if (left.hookEventName !== right.hookEventName) return right

  const merged = { ...left, ...right }
  if (typeof left.additionalContext === 'string' && typeof right.additionalContext === 'string') {
    merged.additionalContext = `${left.additionalContext}\n${right.additionalContext}`
  }
  return merged
}

export const readClaudeHooksConfig = (configPath: string): ClaudeHooksConfig => {
  const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as unknown
  if (!isRecord(parsed)) return {}
  return isRecord(parsed.hooks)
    ? parsed as ClaudeHooksConfig
    : { hooks: parsed as ClaudeHooksConfig['hooks'] }
}

export const getEventGroups = (config: ClaudeHooksConfig, eventName: keyof HookInputs) => {
  const groups = config.hooks?.[eventName]
  return Array.isArray(groups)
    ? groups.filter((group): group is ClaudeCommandHookGroup => isRecord(group))
    : []
}

export const matchesToolHook = (eventName: keyof HookInputs, group: ClaudeCommandHookGroup, input: HookInput) => {
  if ((eventName !== 'PreToolUse' && eventName !== 'PostToolUse') || group.matcher == null || group.matcher === '') {
    return true
  }

  try {
    const toolName = 'toolName' in input ? input.toolName : ''
    return new RegExp(group.matcher).test(toolName)
  } catch {
    return false
  }
}

export const mergeHookOutputs = <T extends HookOutputCore>(left: T, right: T): T =>
  ({
    ...left,
    ...right,
    continue: right.continue ?? left.continue,
    suppressOutput: Boolean(left.suppressOutput) || Boolean(right.suppressOutput),
    systemMessage: mergeSystemMessage(left.systemMessage, right.systemMessage),
    stopReason: right.stopReason ?? left.stopReason,
    ...('hookSpecificOutput' in left || 'hookSpecificOutput' in right
      ? {
        hookSpecificOutput: mergeHookSpecificOutput(
          (left as Record<string, unknown>).hookSpecificOutput,
          (right as Record<string, unknown>).hookSpecificOutput
        )
      }
      : {})
  }) as T

export const runClaudeCommandHook = async <K extends keyof HookInputs>(params: {
  command: string
  eventName: K
  input: HookInputs[K]
  cwd: string
  claudePluginRoot: string
  pluginDataDir: string
}): Promise<HookOutputs[K]> => {
  const output = await new Promise<{ code: number; stdout: string; stderr: string }>((resolvePromise, reject) => {
    const child = spawn(params.command, {
      cwd: params.cwd,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: params.input.cwd,
        CLAUDE_PLUGIN_ROOT: params.claudePluginRoot,
        CLAUDE_PLUGIN_DATA: params.pluginDataDir,
        CLAUDE_PLUGIN_DIR: params.claudePluginRoot,
        CLAUDE_HOOK_EVENT_NAME: params.eventName
      },
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => {
      stdout += String(chunk)
    })
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', code => resolvePromise({ code: code ?? 1, stdout, stderr }))
    child.stdin.write(`${JSON.stringify(toSnakeCaseRecord(params.input))}\n`)
    child.stdin.end()
  })

  if (output.code !== 0) {
    return {
      continue: false,
      stopReason: output.stderr.trim() || `Hook command exited with code ${output.code}.`
    } as HookOutputs[K]
  }

  const trimmedStdout = output.stdout.trim()
  if (trimmedStdout === '') return { continue: true } as HookOutputs[K]

  try {
    return JSON.parse(trimmedStdout) as HookOutputs[K]
  } catch {
    return {
      continue: true,
      systemMessage: trimmedStdout
    } as HookOutputs[K]
  }
}
