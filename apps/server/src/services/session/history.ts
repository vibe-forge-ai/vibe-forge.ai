import type { ChatMessage, ChatMessageContent, Session, WSEvent } from '@vibe-forge/core'

import { getDb } from '#~/db/index.js'
import { extractTextFromMessage } from '#~/services/session/events.js'
import { notifySessionUpdated } from '#~/services/session/runtime.js'
import { deleteSessionWorkspace, provisionSessionWorkspace } from '#~/services/session/workspace.js'
import { badRequest, notFound } from '#~/utils/http.js'
import { safeJsonStringify } from '#~/utils/json.js'

export type MessageBranchAction = 'fork' | 'recall' | 'edit'

interface BranchedHistorySelection {
  retainedEvents: WSEvent[]
  replayContent?: string | ChatMessageContent[]
}

const stringifySeedValue = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  const serialized = safeJsonStringify(value, 2).trim()
  return serialized === '""' ? '' : serialized
}

const buildTextFromMessage = (message: ChatMessage) => {
  const parts: string[] = []

  if (typeof message.content === 'string') {
    const text = message.content.trim()
    if (text !== '') {
      parts.push(text)
    }
  } else if (Array.isArray(message.content)) {
    for (const item of message.content) {
      if (item.type === 'text') {
        const text = item.text.trim()
        if (text !== '') {
          parts.push(text)
        }
        continue
      }

      if (item.type === 'image') {
        parts.push(item.name?.trim() ? `[图片:${item.name.trim()}]` : '[图片]')
        continue
      }

      if (item.type === 'file') {
        parts.push(`[文件:${item.path}]`)
        continue
      }

      if (item.type === 'tool_use') {
        const input = stringifySeedValue(item.input)
        parts.push(input !== '' ? `[工具调用:${item.name}] ${input}` : `[工具调用:${item.name}]`)
        continue
      }

      if (item.type === 'tool_result') {
        const output = stringifySeedValue(item.content)
        const resultLabel = item.is_error === true ? '[工具结果:错误]' : '[工具结果]'
        parts.push(output !== '' ? `${resultLabel} ${output}` : resultLabel)
      }
    }
  }

  const hasStructuredToolItems = Array.isArray(message.content) &&
    message.content.some(item => item.type === 'tool_use' || item.type === 'tool_result')
  if (message.toolCall != null && !hasStructuredToolItems) {
    const input = stringifySeedValue(message.toolCall.args)
    const output = stringifySeedValue(message.toolCall.output)
    parts.push(input !== '' ? `[工具调用:${message.toolCall.name}] ${input}` : `[工具调用:${message.toolCall.name}]`)
    if (output !== '') {
      const resultLabel = message.toolCall.status === 'error' ? '[工具结果:错误]' : '[工具结果]'
      parts.push(`${resultLabel} ${output}`)
    }
  }

  return parts.join('\n').trim()
}

const buildHistorySeed = (messages: ChatMessage[]) => {
  if (messages.length === 0) {
    return undefined
  }

  const lines = [
    '以下是这个分支已经确认过的对话历史，请将其视为既有上下文并在后续继续，不要把它当成用户刚刚重新发送的内容。',
    ''
  ]

  for (const message of messages) {
    const content = buildTextFromMessage(message)
    if (content === '') {
      continue
    }

    const roleLabel = message.role === 'user'
      ? '用户'
      : message.role === 'assistant'
      ? '助手'
      : '系统'
    lines.push(`${roleLabel}：${content}`)
    lines.push('')
  }

  const prompt = lines.join('\n').trim()
  return prompt === '' ? undefined : prompt
}

const getLastMessageSummary = (messages: ChatMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = extractTextFromMessage(messages[index])
    if (text != null && text.trim() !== '') {
      return text.trim()
    }
  }
  return undefined
}

const getLastUserMessageSummary = (messages: ChatMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'user') {
      continue
    }
    const text = extractTextFromMessage(message)
    if (text != null && text.trim() !== '') {
      return text.trim()
    }
  }
  return undefined
}

const cloneReplayContent = (content: ChatMessage['content']) => {
  return typeof content === 'string' ? content : structuredClone(content)
}

const normalizeEditedContent = (content?: string | ChatMessageContent[]) => {
  if (typeof content === 'string') {
    const trimmed = content.trim()
    return trimmed === '' ? undefined : trimmed
  }

  if (!Array.isArray(content)) {
    return undefined
  }

  const normalized: ChatMessageContent[] = []
  for (const item of content) {
    if (item.type === 'text') {
      const text = item.text.trim()
      if (text !== '') {
        normalized.push({ type: 'text', text })
      }
      continue
    }

    if (item.type === 'image') {
      normalized.push({
        type: 'image',
        url: item.url,
        name: item.name,
        size: item.size,
        mimeType: item.mimeType
      })
      continue
    }

    throw badRequest('Edited message content is not supported', undefined, 'unsupported_edited_message_content')
  }

  return normalized.length === 0 ? undefined : normalized
}

const selectHistoryForAction = (
  events: WSEvent[],
  messageId: string,
  action: MessageBranchAction,
  editedContent?: string | ChatMessageContent[]
): BranchedHistorySelection => {
  const targetEventIndex = events.findIndex((event) => event.type === 'message' && event.message.id === messageId)
  if (targetEventIndex < 0) {
    throw notFound('Message not found', { messageId }, 'message_not_found')
  }

  const targetEvent = events[targetEventIndex]
  if (targetEvent.type !== 'message') {
    throw notFound('Message not found', { messageId }, 'message_not_found')
  }

  if (targetEvent.message.role !== 'user') {
    if (action === 'fork') {
      throw badRequest('Only user messages can be forked', { messageId }, 'message_action_not_supported')
    }

    throw badRequest('Only user messages can be edited or recalled', { messageId }, 'message_action_not_supported')
  }

  if (action === 'fork') {
    return {
      retainedEvents: events.slice(0, targetEventIndex),
      replayContent: cloneReplayContent(targetEvent.message.content)
    }
  }

  if (action === 'edit') {
    const nextContent = normalizeEditedContent(editedContent)
    if (nextContent == null) {
      throw badRequest('Edited message cannot be empty', undefined, 'empty_edited_message')
    }

    return {
      retainedEvents: events.slice(0, targetEventIndex),
      replayContent: nextContent
    }
  }

  return {
    retainedEvents: events.slice(0, targetEventIndex)
  }
}

const getVisibleMessages = (events: WSEvent[]) => {
  return events
    .filter((event): event is Extract<WSEvent, { type: 'message' }> => event.type === 'message')
    .map(event => event.message)
}

export async function branchSessionFromMessage(options: {
  sessionId: string
  messageId: string
  action: MessageBranchAction
  content?: string | ChatMessageContent[]
  title?: string
}): Promise<{ session: Session; replayContent?: string | ChatMessageContent[] }> {
  const db = getDb()
  const originalSession = db.getSession(options.sessionId)
  if (originalSession == null) {
    throw notFound('Session not found', { sessionId: options.sessionId }, 'session_not_found')
  }

  if (originalSession.status === 'running' || originalSession.status === 'waiting_input') {
    throw badRequest('Session is busy', { sessionId: options.sessionId }, 'session_busy')
  }

  const selection = selectHistoryForAction(
    db.getMessages(options.sessionId) as WSEvent[],
    options.messageId,
    options.action,
    options.content
  )

  const visibleMessages = getVisibleMessages(selection.retainedEvents)
  const historySeed = buildHistorySeed(visibleMessages)
  const trimmedTitle = options.title?.trim()
  const branchTitle = trimmedTitle != null && trimmedTitle !== ''
    ? trimmedTitle
    : originalSession.title

  const branchSession = db.createSession(
    branchTitle,
    undefined,
    visibleMessages.length > 0 ? 'completed' : undefined,
    originalSession.id,
    {
      runtimeKind: 'interactive',
      historySeed,
      historySeedPending: historySeed != null
    }
  )

  for (const event of selection.retainedEvents) {
    db.saveMessage(branchSession.id, event)
  }

  if (Array.isArray(originalSession.tags) && originalSession.tags.length > 0) {
    db.updateSessionTags(branchSession.id, originalSession.tags)
  }

  db.updateSession(branchSession.id, {
    lastMessage: getLastMessageSummary(visibleMessages),
    lastUserMessage: getLastUserMessageSummary(visibleMessages),
    model: originalSession.model,
    adapter: originalSession.adapter,
    permissionMode: originalSession.permissionMode,
    effort: originalSession.effort,
    isStarred: false,
    isArchived: false
  })

  try {
    await provisionSessionWorkspace(branchSession.id, {
      sourceSessionId: originalSession.id
    })
  } catch (error) {
    await deleteSessionWorkspace(branchSession.id, { force: true }).catch(() => undefined)
    db.deleteSession(branchSession.id)
    throw error
  }

  const createdSession = db.getSession(branchSession.id)
  if (createdSession == null) {
    throw notFound('Branch session not found', { sessionId: branchSession.id }, 'branch_session_not_found')
  }

  notifySessionUpdated(createdSession.id, createdSession)
  return {
    session: createdSession,
    replayContent: selection.replayContent
  }
}
