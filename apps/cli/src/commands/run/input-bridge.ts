import type { Buffer } from 'node:buffer'
import { createInterface } from 'node:readline'

import type { ChatMessageContent } from '@vibe-forge/core'

import { parseCliInputControlEvent } from './input-control'
import type { CliInputControlEvent, CliInputSession, RunInputFormat } from './types'

const dispatchCliInputControlEvent = async (params: {
  session: CliInputSession
  event: CliInputControlEvent
  transformMessageContent?: (content: ChatMessageContent[]) => ChatMessageContent[]
  submitInput?: (event: Extract<CliInputControlEvent, { type: 'submit_input' }>) => void | Promise<void>
}) => {
  const { session, event, submitInput, transformMessageContent } = params
  if (event.type === 'interrupt') {
    session.emit({ type: 'interrupt' })
    return
  }
  if (event.type === 'stop') {
    session.emit({ type: 'stop' })
    return
  }
  if (event.type === 'submit_input') {
    if (submitInput == null) {
      throw new TypeError('The current session does not support submit_input events.')
    }
    await submitInput(event)
    return
  }

  const content = typeof event.content === 'string'
    ? [{ type: 'text', text: event.content } satisfies ChatMessageContent]
    : event.content ?? []

  session.emit({
    type: 'message',
    content: transformMessageContent?.(content) ?? content
  })
}

export const attachInputBridge = (params: {
  format: RunInputFormat
  session: CliInputSession
  stdin: NodeJS.ReadStream
  onError: (message: string) => void
  onInputClosed: () => void
  transformMessageContent?: (content: ChatMessageContent[]) => ChatMessageContent[]
  submitInput?: (event: Extract<CliInputControlEvent, { type: 'submit_input' }>) => void | Promise<void>
}) => {
  const { format, session, stdin, onError, onInputClosed, submitInput, transformMessageContent } = params
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
        void dispatchCliInputControlEvent({
          session,
          event: parseCliInputControlEvent(JSON.parse(trimmed)),
          transformMessageContent,
          submitInput
        }).catch((error) => {
          onError(error instanceof Error ? error.message : String(error))
        })
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
        void dispatchCliInputControlEvent({
          session,
          event: parseCliInputControlEvent(payload),
          transformMessageContent,
          submitInput
        }).catch((error) => {
          onError(error instanceof Error ? error.message : String(error))
        })
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
