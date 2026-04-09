import type { ChatMessage, ChatMessageContent, WSEvent } from '@vibe-forge/core'

import { getDb } from '#~/db/index.js'

import { buildToolCallDetailUrl } from './session-detail-url'
import { resolveBinding } from './state'
import { normalizeToolDisplayName } from './tool-call-name'
import type { ChannelRuntimeState } from './types'

type ToolCallStatus = 'pending' | 'success' | 'error'

export interface ResolvedToolCallPayload {
  toolUseId: string
  name: string
  status: ToolCallStatus
  args?: unknown
  result?: unknown
}

export interface SendToolCallJsonFileResult {
  ok: boolean
  statusCode: number
  message: string
  detailUrl?: string
  fileName?: string
}

const normalizeString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const sanitizeFileNamePart = (value: string) => {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return normalized === '' ? 'tool-call' : normalized
}

const resolveToolExportFileName = (name: string, toolUseId: string) => (
  `${sanitizeFileNamePart(normalizeToolDisplayName(name))}-${sanitizeFileNamePart(toolUseId)}.json`
)

const isToolUseContent = (item: ChatMessageContent): item is Extract<ChatMessageContent, { type: 'tool_use' }> =>
  item.type === 'tool_use'

const isToolResultContent = (item: ChatMessageContent): item is Extract<ChatMessageContent, { type: 'tool_result' }> =>
  item.type === 'tool_result'

const updateFromMessageContent = (
  current: ResolvedToolCallPayload | undefined,
  message: ChatMessage,
  toolUseId: string
) => {
  let next = current

  if (Array.isArray(message.content)) {
    for (const item of message.content) {
      if (isToolUseContent(item) && normalizeString(item.id) === toolUseId) {
        next = {
          toolUseId,
          name: item.name,
          status: next?.status ?? 'pending',
          args: item.input,
          result: next?.result
        }
      }

      if (isToolResultContent(item) && normalizeString(item.tool_use_id) === toolUseId) {
        next = {
          toolUseId,
          name: next?.name ?? toolUseId,
          status: item.is_error === true ? 'error' : 'success',
          args: next?.args,
          result: item.content
        }
      }
    }
  }

  if (message.toolCall != null && normalizeString(message.toolCall.id) === toolUseId) {
    next = {
      toolUseId,
      name: message.toolCall.name,
      status: message.toolCall.status === 'error'
        ? 'error'
        : message.toolCall.output != null
        ? 'success'
        : 'pending',
      args: message.toolCall.args,
      result: message.toolCall.output
    }
  }

  return next
}

export const resolveToolCallPayload = (sessionId: string, toolUseId: string) => {
  const events = getDb().getMessages(sessionId) as WSEvent[]
  let resolved: ResolvedToolCallPayload | undefined

  for (const event of events) {
    if (event.type !== 'message') {
      continue
    }

    resolved = updateFromMessageContent(resolved, event.message, toolUseId) ?? resolved
  }

  return resolved
}

export const sendToolCallJsonFile = async (
  states: Map<string, ChannelRuntimeState>,
  params: {
    sessionId: string
    toolUseId: string
    messageId?: string
  }
): Promise<SendToolCallJsonFileResult> => {
  const binding = resolveBinding(params.sessionId)
  if (binding == null) {
    return {
      ok: false,
      statusCode: 404,
      message: '当前会话没有找到可用的 channel 绑定。'
    }
  }

  const state = states.get(binding.channelKey)
  if (state?.connection?.sendFileMessage == null) {
    return {
      ok: false,
      statusCode: 501,
      message: '当前 channel 不支持通过 server 动作回传文件。'
    }
  }

  const resolved = resolveToolCallPayload(params.sessionId, params.toolUseId)
  if (resolved == null) {
    return {
      ok: false,
      statusCode: 404,
      message: '没有找到对应的工具调用记录。'
    }
  }

  const detailUrl = buildToolCallDetailUrl(state.config, {
    sessionId: params.sessionId,
    toolUseId: params.toolUseId,
    messageId: params.messageId
  })
  const fileName = resolveToolExportFileName(resolved.name, resolved.toolUseId)
  const receiveId = binding.replyReceiveId ?? binding.channelId
  const receiveIdType = binding.replyReceiveIdType ?? 'chat_id'
  const fileContent = JSON.stringify({
    sessionId: params.sessionId,
    messageId: params.messageId,
    toolUseId: resolved.toolUseId,
    name: resolved.name,
    status: resolved.status,
    args: resolved.args,
    result: resolved.result,
    detailUrl,
    exportedAt: new Date().toISOString()
  }, null, 2)

  await state.connection.sendFileMessage({
    receiveId,
    receiveIdType,
    fileName,
    content: fileContent
  })

  return {
    ok: true,
    statusCode: 200,
    message: '已请求机器人把完整 JSON 文件发送回当前会话。',
    detailUrl,
    fileName
  }
}
