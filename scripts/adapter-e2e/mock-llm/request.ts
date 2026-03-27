import { Buffer } from 'node:buffer'

import type { JsonObject, JsonValue } from '../types'

export const asObject = (value: JsonValue | undefined): JsonObject => (
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {}
)

export const asArray = (value: JsonValue | undefined): JsonValue[] => (
  Array.isArray(value) ? value : []
)

export const readJsonBody = async (req: AsyncIterable<Buffer | string>) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  return (raw === '' ? {} : JSON.parse(raw)) as JsonObject
}

export const getRequestInputs = (body: JsonObject): JsonValue[] => {
  const input = body.input
  if (Array.isArray(input)) return input
  const messages = body.messages
  return Array.isArray(messages) ? messages : []
}

export const getRequestText = (body: JsonObject) => (
  getRequestInputs(body)
    .flatMap((item) => {
      const object = asObject(item)
      if (typeof object.content === 'string') return [object.content]
      if (typeof object.text === 'string') return [object.text]
      const parts = asArray(object.content)
      return parts.map((part) => {
        const value = asObject(part)
        if (typeof value.text === 'string') return value.text
        if (typeof value.input_text === 'string') return value.input_text
        return ''
      })
    })
    .filter(text => text.trim() !== '')
    .join('\n')
)

export const isTitleGenerationRequest = (body: JsonObject) => {
  const requestText = getRequestText(body)
  return requestText.includes('Generate a title for this conversation')
    || requestText.includes('You are a title generator')
}

export const hasToolResult = (body: JsonObject) => (
  getRequestInputs(body).some((item) => {
    const value = asObject(item)
    return value.type === 'function_call_output' || value.role === 'tool'
  })
)

export const isStreamRequest = (
  body: JsonObject,
  acceptHeader: string | undefined
) => (
  body.stream === true || String(acceptHeader ?? '').includes('text/event-stream')
)
