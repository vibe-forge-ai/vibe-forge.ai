import type { ChatMessageContent } from '@vibe-forge/core'

type JsonObject = Record<string, unknown>

const asRecord = (value: unknown): JsonObject | undefined => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
    ? value as JsonObject
    : undefined
)

const asString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

export const buildCliSkillContent = () => [
  '# CLI Runtime',
  '',
  'This client exposes the currently running `vf run` process.',
  '',
  'Read `/state` first, then open the focused child skill you need:',
  '- `/input/skill.md`',
  '- `/interaction/skill.md`',
  '- `/process/skill.md`',
  '',
  'Other read paths:',
  '- `GET /state`',
  '- `GET /startup`'
].join('\n')

export const buildCliInputSkillContent = () => [
  '# CLI Input',
  '',
  '- `POST /input/send`: send a user message into the running session.',
  '',
  'Accepted bodies:',
  '- raw string body',
  '- `{ "text": "..." }`',
  '- `{ "content": [ ...ChatMessageContent items... ] }`'
].join('\n')

export const buildCliInteractionSkillContent = () => [
  '# CLI Interaction',
  '',
  '- `POST /interaction/respond`: answer a pending interaction request.',
  '',
  'Accepted bodies:',
  '- `{ "interactionId": "<optional-id>", "data": "..." }`',
  '- `{ "interactionId": "<optional-id>", "data": ["...", "..."] }`',
  '',
  'When there is only one pending interaction, `interactionId` may be omitted and the active one from `/state` will be used.'
].join('\n')

export const buildCliProcessSkillContent = () => [
  '# CLI Process',
  '',
  '- `POST /process/interrupt`: interrupt the current turn.',
  '- `POST /process/stop`: gracefully stop the current session process.',
  '- `POST /process/kill`: force kill the current session process.'
].join('\n')

export const toCliMessageContent = (value: unknown): ChatMessageContent[] => {
  if (typeof value === 'string') {
    const text = value.trim()
    if (text === '') {
      throw new Error('message content is required')
    }
    return [{ type: 'text', text }]
  }

  if (Array.isArray(value)) {
    return value as ChatMessageContent[]
  }

  const payload = asRecord(value)
  if (payload == null) {
    throw new Error('message content is required')
  }

  if (Array.isArray(payload.content)) {
    return payload.content as ChatMessageContent[]
  }

  const text = asString(payload.text)
  if (text !== '') {
    return [{ type: 'text', text }]
  }

  throw new Error('message content is required')
}

export const toCliInteractionData = (value: unknown): string | string[] => {
  if (typeof value === 'string') {
    const text = value.trim()
    if (text === '') {
      throw new Error('interaction data is required')
    }
    return text
  }

  if (Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim() !== '')) {
    return value as string[]
  }

  throw new Error('interaction data must be a non-empty string or string array')
}
