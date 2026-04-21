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
  'Use this client when you need to work through the currently running `vf run` process as its owner runtime.',
  '',
  'This client is for problems like:',
  '- checking what the running CLI session is doing now',
  '- sending a new user turn into the active session',
  '- replying to a pending interaction or approval request',
  '- interrupting, stopping or force-killing the current process',
  '',
  'Recommended order:',
  '1. Read `GET /state` to understand the active session, pending interaction and process state.',
  '2. Read `GET /startup` if you need launch context such as cwd or startup options.',
  '3. Open one focused child skill instead of scanning every mutation path.',
  '',
  'Focused child skills:',
  '- `/input/skill.md`',
  '- `/interaction/skill.md`',
  '- `/process/skill.md`',
  '',
  'Typical task routing:',
  '- send a normal user turn -> `/input/skill.md`',
  '- answer a pending prompt or approval -> `/interaction/skill.md`',
  '- interrupt, stop or kill the runtime -> `/process/skill.md`',
  '',
  'Other read paths:',
  '- `GET /state`',
  '- `GET /startup`'
].join('\n')

export const buildCliInputSkillContent = () => [
  '# CLI Input',
  '',
  'Use this skill when the task is to inject a new user turn into the running CLI session.',
  '',
  'Primary entry point:',
  '- `POST /input/send`: send a user message into the running session.',
  '',
  'Example:',
  '- continue the current task with one new prompt -> `POST /input/send` with `{ "text": "continue from the last checkpoint" }`',
  '',
  'Accepted bodies:',
  '- raw string body',
  '- `{ "text": "..." }`',
  '- `{ "content": [ ...ChatMessageContent items... ] }`'
].join('\n')

export const buildCliInteractionSkillContent = () => [
  '# CLI Interaction',
  '',
  'Use this skill when the running CLI session is blocked on a pending interaction and needs your answer.',
  '',
  'Primary entry point:',
  '- `POST /interaction/respond`: answer a pending interaction request.',
  '',
  'Example:',
  '- approve a pending selection when there is only one active interaction -> `POST /interaction/respond` with `{ "data": "allow_once" }`',
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
  'Use this skill when the task is about controlling the process itself instead of sending normal chat input.',
  '',
  'This covers problems like interrupting a long turn, gracefully stopping the session, or force-killing a stuck process.',
  '',
  'Primary entry points:',
  '- `POST /process/interrupt`: interrupt the current turn.',
  '- `POST /process/stop`: gracefully stop the current session process.',
  '- `POST /process/kill`: force kill the current session process.',
  '',
  'Examples:',
  '- stop the current turn but keep the process alive -> `POST /process/interrupt`',
  '- terminate a clearly stuck process -> `POST /process/kill`'
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
