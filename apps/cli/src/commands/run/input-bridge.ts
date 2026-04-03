import { createInterface } from 'node:readline'
import type { Buffer } from 'node:buffer'

import type { ChatMessageContent } from '@vibe-forge/core'

import type { CliInputControlEvent, CliInputSession, RunInputFormat } from './types'

const isChatTextContent = (value: unknown): value is Extract<ChatMessageContent, { type: 'text' }> => (
  value != null &&
  typeof value === 'object' &&
  (value as { type?: unknown }).type === 'text' &&
  typeof (value as { text?: unknown }).text === 'string'
)

const isChatImageContent = (value: unknown): value is Extract<ChatMessageContent, { type: 'image' }> => (
  value != null &&
  typeof value === 'object' &&
  (value as { type?: unknown }).type === 'image' &&
  typeof (value as { url?: unknown }).url === 'string'
)

const normalizeChatInputContent = (value: unknown): string | ChatMessageContent[] => {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    const items = value.filter((item): item is ChatMessageContent =>
      isChatTextContent(item) || isChatImageContent(item)
    )
    if (items.length > 0) {
      return items
    }
  }

  throw new Error('Unsupported message content. Use a string or an array of text/image content items.')
}

export const parseCliInputControlEvent = (value: unknown): CliInputControlEvent => {
  if (typeof value === 'string') {
    return {
      type: 'message',
      content: value
    }
  }

  if (Array.isArray(value)) {
    return {
      type: 'message',
      content: normalizeChatInputContent(value)
    }
  }

  if (value == null || typeof value !== 'object') {
    throw new Error('Invalid input payload. Expected a string, array, or object.')
  }

  const record = value as Record<string, unknown>
  const type = typeof record.type === 'string' ? record.type : 'message'
  if (type === 'interrupt') {
    return { type: 'interrupt' }
  }
  if (type === 'stop') {
    return { type: 'stop' }
  }
  if (type === 'message' || type === 'user_message') {
    const content = record.content ?? record.text ?? record.message
    if (content == null) {
      throw new Error('Message input requires "content" or "text".')
    }
    return {
      type: 'message',
      content: normalizeChatInputContent(content)
    }
  }

  throw new Error(`Unsupported input event type: ${type}`)
}

const dispatchCliInputControlEvent = (
  session: CliInputSession,
  event: CliInputControlEvent
) => {
  if (event.type === 'interrupt') {
    session.emit({ type: 'interrupt' })
    return
  }
  if (event.type === 'stop') {
    session.emit({ type: 'stop' })
    return
  }

  const content = typeof event.content === 'string'
    ? [{ type: 'text', text: event.content } satisfies ChatMessageContent]
    : event.content

  session.emit({
    type: 'message',
    content
  })
}

export const attachInputBridge = (params: {
  format: RunInputFormat
  session: CliInputSession
  stdin: NodeJS.ReadStream
  onError: (message: string) => void
  onInputClosed: () => void
}) => {
  const { format, session, stdin, onError, onInputClosed } = params
  stdin.setEncoding('utf8')

  if (format === 'stream-json') {
    const rl = createInterface({ input: stdin, crlfDelay: Infinity })
    const onEnd = () => {
      onInputClosed()
    }
    rl.on('line', (line) => {
      const trimmed = line.trim()
      if (trimmed === '') return
      try {
        dispatchCliInputControlEvent(session, parseCliInputControlEvent(JSON.parse(trimmed)))
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error))
      }
    })
    stdin.once('end', onEnd)
    return () => {
      stdin.off('end', onEnd)
      rl.close()
    }
  }

  const chunks: string[] = []
  const onData = (chunk: string | Buffer) => {
    chunks.push(String(chunk))
  }
  const onEnd = () => {
    const raw = chunks.join('')
    if (raw.trim() !== '') {
      try {
        const payload = format === 'json' ? JSON.parse(raw) : raw
        dispatchCliInputControlEvent(session, parseCliInputControlEvent(payload))
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error))
      }
    }
    onInputClosed()
  }

  stdin.on('data', onData)
  stdin.once('end', onEnd)
  return () => {
    stdin.off('data', onData)
    stdin.off('end', onEnd)
  }
}
