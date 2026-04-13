import type { LarkMention } from '#~/types.js'
import { parseLarkContent } from '#~/utils/parse.js'

import { ensureSuccess, isRecord, resolveDefaultChatId } from './shared.js'
import type { LarkImClient } from './shared.js'
import type { LarkMcpRuntimeEnv, LarkMessageReceiveIdType, LarkMessageSortType } from './types.js'

const DEFAULT_RECENT_MESSAGE_LIMIT = 10
const MAX_RECENT_MESSAGE_LIMIT = 50
const DEFAULT_SCAN_LIMIT = 100
const MAX_SCAN_LIMIT = 200

const toUnixSecondsString = (value: number) => String(Math.floor(value / 1000))

const normalizeString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const normalizeMessageMentions = (mentions: unknown): LarkMention[] => {
  if (!Array.isArray(mentions)) {
    return []
  }

  return mentions.flatMap((item) => {
    if (!isRecord(item)) {
      return []
    }

    const key = normalizeString(item.key)
    const id = normalizeString(item.id)
    const name = normalizeString(item.name)
    const tenantKey = normalizeString(item.tenant_key)

    return [{
      key: key === '' ? undefined : key,
      id: id === '' ? undefined : { open_id: id },
      name: name === '' ? undefined : name,
      tenant_key: tenantKey === '' ? undefined : tenantKey
    }]
  })
}

const parseBodyContent = (content: unknown) => {
  if (typeof content !== 'string' || content.trim() === '') {
    return undefined
  }

  try {
    return JSON.parse(content) as unknown
  } catch {
    return undefined
  }
}

const resolvePostMessageText = (bodyContent: unknown) => {
  const parsed = parseBodyContent(bodyContent)
  if (!isRecord(parsed) || !Array.isArray(parsed.content)) {
    return undefined
  }

  const lines: string[] = []
  const title = normalizeString(parsed.title)
  if (title !== '') {
    lines.push(title)
  }

  for (const row of parsed.content) {
    if (!Array.isArray(row)) {
      continue
    }

    let line = ''
    for (const node of row) {
      if (!isRecord(node)) {
        continue
      }

      const tag = normalizeString(node.tag)
      if (tag === 'text') {
        line += typeof node.text === 'string' ? node.text : ''
        continue
      }

      if (tag === 'a') {
        line += typeof node.text === 'string' ? node.text : ''
        continue
      }

      if (tag === 'at') {
        const userName = normalizeString(node.user_name)
        line += userName === '' ? '@mention' : `@${userName}`
        continue
      }

      if (tag === 'img') {
        line += '[image]'
      }
    }

    const normalizedLine = line.trim()
    if (normalizedLine !== '') {
      lines.push(normalizedLine)
    }
  }

  return lines.join('\n').trim() || undefined
}

const resolveMessageFallbackText = (
  msgType: string,
  bodyContent: unknown
) => {
  const parsed = parseBodyContent(bodyContent)
  if (!isRecord(parsed)) {
    if (msgType === 'interactive') return '[interactive]'
    return `[${msgType}]`
  }

  if (msgType === 'file') {
    const fileName = normalizeString(parsed.file_name)
    return fileName === '' ? '[file]' : `[file] ${fileName}`
  }

  if (msgType === 'image') {
    const imageKey = normalizeString(parsed.image_key)
    return imageKey === '' ? '[image]' : `[image] ${imageKey}`
  }

  if (msgType === 'audio') {
    return '[audio]'
  }

  if (msgType === 'media') {
    return '[media]'
  }

  if (msgType === 'interactive') {
    const title = normalizeString(parsed.title)
    return title === '' ? '[interactive]' : `[interactive] ${title}`
  }

  return `[${msgType}]`
}

const toIsoTime = (timestamp: unknown) => {
  const raw = normalizeString(timestamp)
  if (raw === '') {
    return undefined
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    return undefined
  }

  return new Date(parsed).toISOString()
}

const resolveSender = (sender: unknown) => {
  if (!isRecord(sender)) {
    return undefined
  }

  const id = normalizeString(sender.id)
  const idType = normalizeString(sender.id_type)
  const senderType = normalizeString(sender.sender_type)
  const tenantKey = normalizeString(sender.tenant_key)

  return {
    id: id === '' ? undefined : id,
    idType: idType === '' ? undefined : idType as LarkMessageReceiveIdType | 'app_id' | 'unknown',
    senderType: senderType === '' ? undefined : senderType,
    tenantKey: tenantKey === '' ? undefined : tenantKey
  }
}

const normalizeMessageItem = async (item: unknown) => {
  if (!isRecord(item)) {
    return undefined
  }

  const messageId = normalizeString(item.message_id)
  if (messageId === '') {
    return undefined
  }

  const msgType = normalizeString(item.msg_type) || 'unknown'
  const body = isRecord(item.body) ? item.body : undefined
  const bodyContent = body?.content
  const mentions = normalizeMessageMentions(item.mentions)
  const parsed = await parseLarkContent({
    content: typeof bodyContent === 'string' ? bodyContent : undefined,
    mentions
  })
  const text = normalizeString(parsed.formattedText) ||
    normalizeString(parsed.rawText) ||
    normalizeString(resolvePostMessageText(bodyContent))
  const summary = text === '' ? resolveMessageFallbackText(msgType, bodyContent) : text
  const createTime = normalizeString(item.create_time)
  const updateTime = normalizeString(item.update_time)

  return {
    messageId,
    rootId: normalizeString(item.root_id) || undefined,
    parentId: normalizeString(item.parent_id) || undefined,
    threadId: normalizeString(item.thread_id) || undefined,
    msgType,
    chatId: normalizeString(item.chat_id) || undefined,
    createTime: createTime === '' ? undefined : createTime,
    createTimeIso: toIsoTime(createTime),
    updateTime: updateTime === '' ? undefined : updateTime,
    updateTimeIso: toIsoTime(updateTime),
    deleted: item.deleted === true,
    updated: item.updated === true,
    sender: resolveSender(item.sender),
    text: text === '' ? undefined : text,
    summary,
    rawContent: typeof bodyContent === 'string' ? bodyContent : undefined
  }
}

const matchesQuery = (value: string | undefined, query: string | undefined) => {
  if (query == null || query === '') {
    return true
  }

  return value?.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ?? false
}

export const createLarkMessageHistoryActions = (
  env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => ({
  listMessages: async (input?: {
    containerId?: string
    containerType?: 'chat' | 'thread'
    startTime?: string
    endTime?: string
    sortType?: LarkMessageSortType
    pageSize?: number
    pageToken?: string
  }) => {
    const containerType = input?.containerType ?? 'chat'
    if (containerType === 'thread') {
      const containerId = input?.containerId
      if (containerId == null || containerId.trim() === '') {
        throw new Error('Missing thread containerId for message history lookup.')
      }

      const result = ensureSuccess(
        'List messages',
        await im.message.list({
          params: {
            container_id: containerId,
            container_id_type: containerType,
            start_time: input?.startTime,
            end_time: input?.endTime,
            sort_type: input?.sortType,
            page_size: input?.pageSize,
            page_token: input?.pageToken
          }
        })
      ) as { data?: unknown }
      return result.data ?? {}
    }

    const containerId = resolveDefaultChatId(env, input?.containerId)
    const result = ensureSuccess(
      'List messages',
      await im.message.list({
        params: {
          container_id: containerId,
          container_id_type: containerType,
          start_time: input?.startTime,
          end_time: input?.endTime,
          sort_type: input?.sortType,
          page_size: input?.pageSize,
          page_token: input?.pageToken
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  getCurrentChatMessages: async (input?: {
    chatId?: string
    limit?: number
    lookbackMinutes?: number
    query?: string
    senderType?: 'user' | 'app' | 'anonymous' | 'unknown'
    includeRawContent?: boolean
  }) => {
    const chatId = resolveDefaultChatId(env, input?.chatId)
    const limit = Math.min(Math.max(input?.limit ?? DEFAULT_RECENT_MESSAGE_LIMIT, 1), MAX_RECENT_MESSAGE_LIMIT)
    const lookbackMinutes = input?.lookbackMinutes
    const query = normalizeString(input?.query)
    const senderType = input?.senderType === 'unknown' ? undefined : input?.senderType
    const includeRawContent = input?.includeRawContent === true
    const scanLimit = Math.min(
      Math.max(limit * 4, DEFAULT_SCAN_LIMIT),
      MAX_SCAN_LIMIT
    )
    const startTime = lookbackMinutes == null
      ? undefined
      : toUnixSecondsString(Date.now() - lookbackMinutes * 60 * 1000)

    const matchedMessages: Array<Awaited<ReturnType<typeof normalizeMessageItem>>> = []
    let pageToken: string | undefined
    let hasMore = false
    let scannedCount = 0

    do {
      const remainingCapacity = scanLimit - scannedCount
      const pageSize = Math.min(MAX_RECENT_MESSAGE_LIMIT, remainingCapacity, Math.max(limit, 20))
      if (pageSize <= 0) {
        break
      }

      const result = ensureSuccess(
        'Get current chat messages',
        await im.message.list({
          params: {
            container_id: chatId,
            container_id_type: 'chat',
            start_time: startTime,
            sort_type: 'ByCreateTimeDesc',
            page_size: pageSize,
            page_token: pageToken
          }
        })
      ) as { data?: unknown }

      const data = isRecord(result.data) ? result.data : {}
      const items = Array.isArray(data.items) ? data.items : []
      hasMore = data.has_more === true
      pageToken = normalizeString(data.page_token) || undefined

      for (const item of items) {
        scannedCount += 1
        const normalized = await normalizeMessageItem(item)
        if (normalized == null) {
          continue
        }

        if (senderType != null && normalized.sender?.senderType !== senderType) {
          continue
        }

        if (!matchesQuery(normalized.text ?? normalized.summary, query === '' ? undefined : query)) {
          continue
        }

        matchedMessages.push(
          includeRawContent ? normalized : {
            ...normalized,
            rawContent: undefined
          }
        )

        if (matchedMessages.length >= limit) {
          break
        }
      }
    } while (
      matchedMessages.length < limit &&
      hasMore &&
      pageToken != null &&
      scannedCount < scanLimit
    )

    return {
      chatId,
      sessionType: env.sessionType,
      scannedCount,
      matchedCount: matchedMessages.length,
      hasMore,
      nextPageToken: hasMore ? pageToken : undefined,
      appliedFilter: {
        limit,
        lookbackMinutes,
        query: query === '' ? undefined : query,
        senderType,
        includeRawContent
      },
      messages: matchedMessages
    }
  }
})
