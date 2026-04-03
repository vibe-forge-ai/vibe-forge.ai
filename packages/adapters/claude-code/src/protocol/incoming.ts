import type { ChatMessage } from '@vibe-forge/core'
import type { AdapterQueryOptions } from '@vibe-forge/types'

import { prefixToolName } from './content'
import type {
  ClaudeCodeContentText,
  ClaudeCodeContentToolResult,
  ClaudeCodeContentToolUse,
  ClaudeCodeIncomingEvent
} from './types'

const PERMISSION_REQUIRED_CODE = 'permission_required'

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

const isPermissionDeniedText = (value: string | undefined) => {
  if (value == null) return false
  const normalized = value.trim()
  if (normalized === '') return false

  return (
    (/permission/i.test(normalized) && /(denied|required|grant|approval|authorized?)/i.test(normalized)) ||
    /权限|授权/.test(normalized)
  )
}

const collectTextFragments = (value: unknown, visited = new WeakSet<object>()): string[] => {
  if (isNonEmptyString(value)) {
    return [value.trim()]
  }

  if (Array.isArray(value)) {
    return [...new Set(value.flatMap(item => collectTextFragments(item, visited)))]
  }

  if (value == null || typeof value !== 'object') {
    return []
  }

  if (visited.has(value)) {
    return []
  }
  visited.add(value)

  const record = value as Record<string, unknown>
  return [...new Set(
    Object.entries(record)
      .filter((entry) => /text|content|message|reason|error/i.test(entry[0]))
      .flatMap((entry) => collectTextFragments(entry[1], visited))
  )]
}

const collectDeniedTools = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap(collectDeniedTools))]
  }
  if (value == null || typeof value !== 'object') {
    return []
  }

  return [...new Set(
    Object.entries(value)
      .filter((entry) =>
        /tool/i.test(entry[0]) &&
        isNonEmptyString(entry[1])
      )
      .map((entry) => entry[1].trim())
  )]
}

const normalizePermissionDenials = (items: unknown[]) => {
  return items
    .map((item) => {
      if (isNonEmptyString(item)) {
        return {
          message: item.trim(),
          deniedTools: [] as string[]
        }
      }
      if (item == null || typeof item !== 'object') {
        return undefined
      }

      const record = item as Record<string, unknown>
      const messages = Object.entries(record)
        .filter((entry) => /message|reason|error/i.test(entry[0]) && isNonEmptyString(entry[1]))
        .map((entry) => String(entry[1]).trim())
      const fallbackMessage = messages.find(message => message !== '')
      return {
        message: fallbackMessage ?? 'Permission required to continue',
        deniedTools: collectDeniedTools(record)
      }
    })
    .filter((item): item is { message: string; deniedTools: string[] } => item != null)
}

export const handleIncomingEvent = (
  data: ClaudeCodeIncomingEvent,
  onEvent: AdapterQueryOptions['onEvent'],
  effort?: AdapterQueryOptions['effort']
) => {
  const emitResultError = (params: {
    message: string
    code?: string
    details?: Record<string, unknown>
  }) => {
    onEvent({
      type: 'error',
      data: {
        message: params.message,
        code: params.code,
        details: params.details,
        fatal: true
      }
    })
  }

  if (data.type === 'system') {
    if (data.subtype === 'init') {
      onEvent({
        type: 'init',
        data: {
          uuid: data.uuid,
          model: data.model,
          effort,
          version: data.claude_code_version,
          tools: (data.tools) as string[],
          slashCommands: (data.slash_commands) as string[],
          cwd: data.cwd,
          agents: (data.agents) as string[]
        }
      })
    }
  }

  if (data.type === 'assistant' && data.message != null) {
    const contentParts = data.message.content
    const textContent = contentParts
      .filter((p): p is ClaudeCodeContentText => p.type === 'text')
      .map(p => p.text)
      .join('')

    const toolUsePart = contentParts.find((p): p is ClaudeCodeContentToolUse => p.type === 'tool_use')

    const assistant: ChatMessage = {
      id: data.uuid,
      role: 'assistant',
      content: textContent,
      createdAt: Date.now(),
      model: data.message.model || data.model,
      usage: data.message.usage
    }

    if (toolUsePart != null) {
      const toolItem = {
        type: 'tool_use' as const,
        id: toolUsePart.id,
        name: prefixToolName(toolUsePart.name),
        input: (toolUsePart.input ?? toolUsePart.args ?? {}) as Record<string, any>
      }

      if (textContent !== '') {
        assistant.content = [
          { type: 'text', text: textContent },
          toolItem
        ]
      } else {
        assistant.content = [toolItem]
      }
    }
    onEvent({ type: 'message', data: assistant })
  }

  if (data.type === 'user' && data.message != null && Array.isArray(data.message.content)) {
    const content = data.message.content
    const toolResultPart = content.find((p): p is ClaudeCodeContentToolResult => p.type === 'tool_result')
    if (toolResultPart != null) {
      const resultMessage: ChatMessage = {
        id: data.uuid,
        role: 'assistant',
        content: [{
          type: 'tool_result' as const,
          tool_use_id: toolResultPart.tool_use_id,
          content: toolResultPart.content,
          is_error: toolResultPart.is_error ?? false
        }],
        createdAt: Date.now()
      }
      onEvent({ type: 'message', data: resultMessage })

      const textFragments = collectTextFragments(toolResultPart.content)
      const permissionText = textFragments.find(isPermissionDeniedText)
      if ((toolResultPart.is_error ?? false) && permissionText != null) {
        emitResultError({
          message: 'Permission required to continue',
          code: PERMISSION_REQUIRED_CODE,
          details: {
            toolUseId: toolResultPart.tool_use_id,
            permissionDenials: [{
              message: permissionText,
              deniedTools: collectDeniedTools(toolResultPart.content)
            }],
            rawPermissionDenial: toolResultPart.content
          }
        })
      }
    }
  }

  if (data.type === 'summary') {
    onEvent({
      type: 'summary',
      data: {
        summary: data.summary,
        leafUuid: data.leafUuid
      }
    })
  }

  if (data.type === 'result') {
    if (data.subtype === 'error_during_execution') {
      const errors = Array.isArray(data.errors) ? data.errors.filter(error => error.trim() !== '') : []
      const permissionRequired = errors.some(isPermissionDeniedText)
      emitResultError({
        message: permissionRequired
          ? 'Permission required to continue'
          : (errors[0] ?? 'Claude Code execution failed'),
        code: permissionRequired ? PERMISSION_REQUIRED_CODE : undefined,
        details: {
          errors,
          sessionId: data.session_id
        }
      })
      return
    }

    if (data.subtype !== 'success') {
      return
    }

    if (data.is_error) {
      const permissionDenials = normalizePermissionDenials(data.permission_denials)
      const permissionRequired = permissionDenials.length > 0 || isPermissionDeniedText(data.result)
      emitResultError({
        message: permissionRequired
          ? 'Permission required to continue'
          : (data.result !== '' ? data.result : 'Claude Code execution failed'),
        code: permissionRequired ? PERMISSION_REQUIRED_CODE : undefined,
        details: {
          sessionId: data.session_id,
          durationMs: data.duration_ms,
          durationApiMs: data.duration_api_ms,
          numTurns: data.num_turns,
          totalCostUsd: data.total_cost_usd,
          usage: data.usage,
          permissionDenials,
          rawPermissionDenials: data.permission_denials
        }
      })
    }

    let messageData: ChatMessage | undefined
    if (data.result != null && data.result !== '') {
      messageData = {
        id: data.uuid,
        role: 'assistant',
        content: data.result,
        createdAt: Date.now(),
        usage: data.usage
      }
    }
    onEvent({ type: 'stop', data: messageData })
  }
}
