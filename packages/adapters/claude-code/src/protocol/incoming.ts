import type { ChatMessage } from '@vibe-forge/core'
import type { AdapterQueryOptions } from '@vibe-forge/types'

import { prefixToolName } from './content'
import type {
  ClaudeCodeContentText,
  ClaudeCodeContentToolResult,
  ClaudeCodeContentToolUse,
  ClaudeCodeIncomingEvent
} from './types'

export const handleIncomingEvent = (
  data: ClaudeCodeIncomingEvent,
  onEvent: AdapterQueryOptions['onEvent'],
  effort?: AdapterQueryOptions['effort']
) => {
  const emitResultError = (params: {
    message: string
    details?: Record<string, unknown>
  }) => {
    onEvent({
      type: 'error',
      data: {
        message: params.message,
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
      emitResultError({
        message: errors[0] ?? 'Claude Code execution failed',
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
      emitResultError({
        message: data.result !== '' ? data.result : 'Claude Code execution failed',
        details: {
          sessionId: data.session_id,
          durationMs: data.duration_ms,
          durationApiMs: data.duration_api_ms,
          numTurns: data.num_turns,
          totalCostUsd: data.total_cost_usd,
          usage: data.usage,
          permissionDenials: data.permission_denials
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
