import type { ChatMessage } from '@vibe-forge/core'
import { uuid } from '@vibe-forge/utils/uuid'

interface KimiToolCall {
  id?: string
  function?: {
    name?: string
    arguments?: string
  }
}

interface KimiOutputLine {
  role?: string
  content?: unknown
  tool_calls?: KimiToolCall[]
  tool_call_id?: string
  is_error?: boolean
}

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value.trim() === '' ? undefined : value
  }

  if (!Array.isArray(value)) return undefined

  const parts = value
    .map((item) => (
      item != null &&
        typeof item === 'object' &&
        (item as Record<string, unknown>).type === 'text' &&
        typeof (item as Record<string, unknown>).text === 'string'
        ? ((item as Record<string, unknown>).text as string)
        : undefined
    ))
    .filter((item): item is string => item != null && item !== '')

  return parts.length > 0 ? parts.join('') : undefined
}

const parseArguments = (value: string | undefined) => {
  if (value == null || value.trim() === '') return {}

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed != null ? parsed : {}
  } catch {
    return { raw: value }
  }
}

export const parseKimiOutputLine = (rawLine: string, model?: string): ChatMessage | undefined => {
  const line = rawLine.trim()
  if (!line.startsWith('{') || !line.endsWith('}')) return undefined

  let parsed: KimiOutputLine
  try {
    parsed = JSON.parse(line) as KimiOutputLine
  } catch {
    return undefined
  }

  if (parsed.role === 'assistant') {
    const textContent = normalizeText(parsed.content)
    const toolCalls = (parsed.tool_calls ?? [])
      .filter(toolCall => toolCall.id != null && toolCall.function?.name != null)
      .map((toolCall) => ({
        type: 'tool_use' as const,
        id: toolCall.id as string,
        name: toolCall.function?.name as string,
        input: parseArguments(toolCall.function?.arguments)
      }))

    if (textContent == null && toolCalls.length === 0) {
      return undefined
    }

    return {
      id: uuid(),
      role: 'assistant',
      content: toolCalls.length === 0
        ? textContent ?? ''
        : [
          ...(textContent != null ? [{ type: 'text' as const, text: textContent }] : []),
          ...toolCalls
        ],
      createdAt: Date.now(),
      ...(model != null ? { model } : {})
    }
  }

  if (parsed.role === 'tool' && typeof parsed.tool_call_id === 'string') {
    return {
      id: uuid(),
      role: 'assistant',
      content: [{
        type: 'tool_result',
        tool_use_id: parsed.tool_call_id,
        content: parsed.content,
        ...(parsed.is_error === true ? { is_error: true } : {})
      }],
      createdAt: Date.now(),
      ...(model != null ? { model } : {})
    }
  }

  return undefined
}
