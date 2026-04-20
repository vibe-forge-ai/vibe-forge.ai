import type { ConfigSource, EffortLevel, Session, SessionPermissionMode, SessionWorkspace } from '@vibe-forge/core'
import type { ChannelBaseConfig, ChannelSendResult } from '@vibe-forge/core/channel'

import type { ChannelBindSessionResult, ChannelContext } from '#~/channels/middleware/@types/index.js'
import { bindChannelSession } from '#~/channels/middleware/bind-session.js'
import { isAdmin } from '#~/channels/middleware/commands/access.js'
import { accessCommands } from '#~/channels/middleware/commands/cmd.access.js'
import { generalCommands } from '#~/channels/middleware/commands/cmd.general.js'
import { sessionCommands } from '#~/channels/middleware/commands/cmd.session.js'
import {
  formatUsage,
  parseCommandString,
  type AnyCommandSpec,
  type CommandArgumentSpec
} from '#~/channels/middleware/commands/command-system.js'
import { ensureSharedCommandMessagesRegistered } from '#~/channels/middleware/commands/index.js'
import type { LanguageCode } from '#~/channels/middleware/i18n.js'
import { createT } from '#~/channels/middleware/i18n.js'
import { deleteBinding } from '#~/channels/state.js'
import { getDb } from '#~/db/index.js'
import { killSession, startAdapterSession } from '#~/services/session/index.js'
import { notifySessionUpdated } from '#~/services/session/runtime.js'
import { resolveSessionWorkspace } from '#~/services/session/workspace.js'

export interface ChannelProcessEntry {
  key: string
  type: string
  instanceKey: string
  label: string
  title?: string
  description?: string
  configSource?: ConfigSource
}

interface JsonObject {
  [key: string]: unknown
}

export interface ChannelProcessTarget {
  sessionType: string
  channelId: string
  senderId?: string
  replyReceiveId?: string
  replyReceiveIdType?: string
}

export interface ChannelPreferenceSummary {
  adapter?: string
  permissionMode?: SessionPermissionMode
  effort?: EffortLevel
  updatedAt: number
}

export interface ChannelBindingSummary {
  sessionId: string
  replyReceiveId?: string
  replyReceiveIdType?: string
  updatedAt: number
}

export interface ChannelContextSummary {
  sessionType: string
  channelId: string
  binding?: ChannelBindingSummary & {
    session?: Session
  }
  preference?: ChannelPreferenceSummary
  updatedAt: number
}

export interface ChannelPreferencePatch {
  adapter?: string | null
  permissionMode?: SessionPermissionMode | null
  effort?: EffortLevel | null
}

interface ChannelCommandArgumentSummary {
  kind: CommandArgumentSpec['kind']
  name: string
  usage: string
  description?: string
  choices?: Array<{
    value: string
    title: string
    description?: string
  }>
}

interface ChannelCommandSummary {
  name: string
  path: string[]
  usage: string
  description?: string
  aliases: string[]
  permission: 'everyone' | 'admin'
  args: ChannelCommandArgumentSummary[]
}

interface ExecuteChannelCommandResult {
  ok: boolean
  commandPath?: string[]
  usage?: string
  code?: string
  message?: string
  replies: Array<{
    messageId: string
    text: string
  }>
  followUps: Array<{
    messageId?: string
    followUps: Array<{
      content: string
      i18nContents?: Array<{
        content: string
        language: string
      }>
    }>
  }>
  context?: ChannelContextSummary
}

export interface ChannelSessionSearchSummary {
  session: Session
  binding?: {
    channelType: string
    sessionType: string
    channelId: string
    channelKey: string
    isCurrentTarget: boolean
  }
}

const asRecord = (value: unknown): JsonObject | undefined => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
    ? value as JsonObject
    : undefined
)

const asString = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const normalizeOptionalString = (value: string | null | undefined) => {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

const resolveCommandPrefix = (config: ChannelBaseConfig | undefined) => config?.commandPrefix ?? '/'

const resolveLanguage = (config: ChannelBaseConfig | undefined): LanguageCode | undefined => {
  const language = config?.language
  return language === 'en' ? 'en' : 'zh'
}

const matchesSessionSearch = (session: Session | undefined, query: string) => {
  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery === '') return true
  const haystack = [
    session?.id,
    session?.title,
    session?.lastMessage,
    session?.lastUserMessage,
    session?.model,
    session?.adapter,
    ...(session?.tags ?? [])
  ]
    .map(value => value?.trim().toLowerCase())
    .filter(Boolean)
    .join('\n')
  return haystack.includes(normalizedQuery)
}

const createChannelCommands = (
  prefix: string
): readonly AnyCommandSpec<ChannelContext>[] => {
  let commands: AnyCommandSpec<ChannelContext>[] | undefined
  const getAllCommands = () => {
    if (commands != null) {
      return commands
    }

    commands = [
      ...generalCommands(() => prefix, getAllCommands),
      ...sessionCommands(() => prefix),
      ...accessCommands()
    ]
    return commands
  }

  return getAllCommands()
}

const formatArgumentUsage = (argument: CommandArgumentSpec) => {
  const choiceSuffix = argument.choices && argument.choices.length > 0
    ? `:${argument.choices.map(choice => choice.value).join('|')}`
    : ''
  switch (argument.kind) {
    case 'required':
      return `<${argument.name}${choiceSuffix}>`
    case 'optional':
      return `[${argument.name}${choiceSuffix}]`
    case 'variadic':
      return `[${argument.name}${choiceSuffix}...]`
    case 'rest':
      return `<${argument.name}${choiceSuffix}>`
  }
}

const summarizeArgument = (
  argument: CommandArgumentSpec,
  translate: (key: string, args?: Record<string, string | number | boolean | undefined>) => string
): ChannelCommandArgumentSummary => ({
  kind: argument.kind,
  name: argument.name,
  usage: formatArgumentUsage(argument),
  ...(argument.description ? { description: translate(argument.description) } : {}),
  ...(argument.choices && argument.choices.length > 0
    ? {
      choices: argument.choices.map((choice) => ({
        value: choice.value,
        title: translate(choice.title),
        ...(choice.description ? { description: translate(choice.description) } : {})
      }))
    }
    : {})
})

const flattenCommands = (
  commands: readonly AnyCommandSpec<ChannelContext>[],
  translate: (key: string, args?: Record<string, string | number | boolean | undefined>) => string,
  prefix: string,
  ancestors: readonly string[] = []
): ChannelCommandSummary[] => {
  const entries: ChannelCommandSummary[] = []

  for (const command of commands) {
    const path = [...ancestors, command.name]
    const usageAncestors = ancestors.length === 0
      ? []
      : [`${prefix}${ancestors[0]}`, ...ancestors.slice(1)]
    entries.push({
      name: command.name,
      path,
      usage: formatUsage(command, usageAncestors, prefix),
      ...(command.descriptionKey ? { description: translate(command.descriptionKey) } : {}),
      aliases: [...command.aliases],
      permission: command.permission,
      args: command.args.map((argument: CommandArgumentSpec) => summarizeArgument(argument, translate))
    })

    if (command.subcommands.length > 0) {
      entries.push(...flattenCommands(command.subcommands, translate, prefix, path))
    }
  }

  return entries
}

const createTargetKey = (sessionType: string, channelId: string) => `${sessionType}\u0000${channelId}`

export const resolveChannelContextSummary = (
  entry: ChannelProcessEntry,
  target: Pick<ChannelProcessTarget, 'sessionType' | 'channelId'>
): ChannelContextSummary => {
  const db = getDb()
  const binding = db.getChannelSession(entry.type, entry.key, target.sessionType, target.channelId)
  const preference = db.getChannelPreference(entry.type, entry.key, target.sessionType, target.channelId)

  return {
    sessionType: target.sessionType,
    channelId: target.channelId,
    ...(binding == null
      ? {}
      : {
        binding: {
          sessionId: binding.sessionId,
          replyReceiveId: binding.replyReceiveId,
          replyReceiveIdType: binding.replyReceiveIdType,
          updatedAt: binding.updatedAt,
          session: db.getSession(binding.sessionId)
        }
      }),
    ...(preference == null
      ? {}
      : {
        preference: {
          adapter: preference.adapter,
          permissionMode: preference.permissionMode,
          effort: preference.effort,
          updatedAt: preference.updatedAt
        }
      }),
    updatedAt: Math.max(binding?.updatedAt ?? 0, preference?.updatedAt ?? 0)
  }
}

const resolveChannelContextsInternal = (
  entry: ChannelProcessEntry,
  filters?: Partial<Pick<ChannelProcessTarget, 'sessionType' | 'channelId'>>
) => {
  const db = getDb()
  const bindings = db.listChannelSessions({
    channelKey: entry.key,
    channelType: entry.type,
    ...(filters?.sessionType ? { sessionType: filters.sessionType } : {})
  })
  const preferences = db.listChannelPreferences({
    channelKey: entry.key,
    channelType: entry.type,
    ...(filters?.sessionType ? { sessionType: filters.sessionType } : {})
  })

  const contexts = new Map<string, ChannelContextSummary>()
  const upsert = (sessionType: string, channelId: string) => {
    if (filters?.channelId && channelId !== filters.channelId) {
      return
    }

    contexts.set(
      createTargetKey(sessionType, channelId),
      resolveChannelContextSummary(entry, {
        sessionType,
        channelId
      })
    )
  }

  for (const binding of bindings) {
    upsert(binding.sessionType, binding.channelId)
  }
  for (const preference of preferences) {
    upsert(preference.sessionType, preference.channelId)
  }

  return Array.from(contexts.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

export const resolveChannelContexts = (
  entry: ChannelProcessEntry,
  filters?: Partial<Pick<ChannelProcessTarget, 'sessionType' | 'channelId'>>
) => ({
  contexts: resolveChannelContextsInternal(entry, filters)
})

export const resolveChannelCommandCatalog = (config: ChannelBaseConfig | undefined) => {
  ensureSharedCommandMessagesRegistered()
  const prefix = resolveCommandPrefix(config)
  const translate = createT(resolveLanguage(config))
  return {
    prefix,
    commands: flattenCommands(createChannelCommands(prefix), translate, prefix)
  }
}

const writeChannelPreference = (params: {
  entry: ChannelProcessEntry
  target: Pick<ChannelProcessTarget, 'sessionType' | 'channelId'>
  updates: ChannelPreferencePatch
}): ChannelPreferenceSummary | undefined => {
  const db = getDb()
  const current = db.getChannelPreference(params.entry.type, params.entry.key, params.target.sessionType, params.target.channelId)

  const nextAdapter = params.updates.adapter === undefined
    ? current?.adapter
    : normalizeOptionalString(params.updates.adapter)
  const nextPermissionMode = params.updates.permissionMode === undefined
    ? current?.permissionMode
    : params.updates.permissionMode ?? undefined
  const nextEffort = params.updates.effort === undefined
    ? current?.effort
    : params.updates.effort ?? undefined

  if (nextAdapter == null && nextPermissionMode == null && nextEffort == null) {
    db.deleteChannelPreference(params.entry.type, params.entry.key, params.target.sessionType, params.target.channelId)
    return undefined
  }

  db.upsertChannelPreference({
    channelType: params.entry.type,
    sessionType: params.target.sessionType,
    channelId: params.target.channelId,
    channelKey: params.entry.key,
    adapter: nextAdapter,
    permissionMode: nextPermissionMode,
    effort: nextEffort
  })

  const updated = db.getChannelPreference(params.entry.type, params.entry.key, params.target.sessionType, params.target.channelId)
  return updated == null
    ? undefined
    : {
      adapter: updated.adapter,
      permissionMode: updated.permissionMode,
      effort: updated.effort,
      updatedAt: updated.updatedAt
    }
}

export const searchChannelSessions = (params: {
  entry: ChannelProcessEntry
  query?: string
  limit?: number
  offset?: number
  target?: Pick<ChannelProcessTarget, 'sessionType' | 'channelId'>
}) => {
  const db = getDb()
  const query = params.query?.trim() ?? ''
  const all = db.getSessions('all')
    .filter(session => matchesSessionSearch(session, query))
    .map<ChannelSessionSearchSummary>((session) => {
      const row = db.getChannelSessionBySessionId(session.id)
      return {
        session,
        ...(row == null
          ? {}
          : {
            binding: {
              channelType: row.channelType,
              sessionType: row.sessionType,
              channelId: row.channelId,
              channelKey: row.channelKey,
              isCurrentTarget: params.target != null &&
                row.channelType === params.entry.type &&
                row.channelKey === params.entry.key &&
                row.sessionType === params.target.sessionType &&
                row.channelId === params.target.channelId
            }
          })
      }
    })

  const total = all.length
  const offset = Math.max(0, params.offset ?? 0)
  const limit = params.limit == null ? total : Math.max(0, params.limit)

  return {
    query,
    total,
    offset,
    limit,
    sessions: limit === 0 ? [] : all.slice(offset, offset + limit)
  }
}

export const bindChannelSessionTarget = (params: {
  entry: ChannelProcessEntry
  target: ChannelProcessTarget
  sessionId: string
}) => {
  const db = getDb()
  const session = db.getSession(params.sessionId)
  if (session == null) {
    throw new Error(`Session not found: ${params.sessionId}`)
  }

  const result = bindChannelSession({
    channelType: params.entry.type,
    sessionType: params.target.sessionType,
    channelId: params.target.channelId,
    channelKey: params.entry.key,
    ...(params.target.replyReceiveId ? { replyReceiveId: params.target.replyReceiveId } : {}),
    ...(params.target.replyReceiveIdType ? { replyReceiveIdType: params.target.replyReceiveIdType } : {}),
    sessionId: params.sessionId
  })

  return {
    session,
    bindingResult: {
      ...result,
      ...(result.transferredFrom == null
        ? {}
        : {
          transferredFrom: {
            channelType: result.transferredFrom.channelType,
            sessionType: result.transferredFrom.sessionType,
            channelId: result.transferredFrom.channelId,
            channelKey: result.transferredFrom.channelKey
          }
        })
    },
    context: resolveChannelContextSummary(params.entry, params.target)
  }
}

export const unbindChannelSessionTarget = (params: {
  entry: ChannelProcessEntry
  target: Pick<ChannelProcessTarget, 'sessionType' | 'channelId'>
}) => {
  const db = getDb()
  const binding = db.getChannelSession(params.entry.type, params.entry.key, params.target.sessionType, params.target.channelId)
  db.deleteChannelSession(params.entry.type, params.entry.key, params.target.sessionType, params.target.channelId)
  if (binding?.sessionId) {
    deleteBinding(binding.sessionId)
  }

  return {
    removed: binding != null,
    sessionId: binding?.sessionId,
    context: resolveChannelContextSummary(params.entry, params.target)
  }
}

export const resetChannelSessionTarget = (params: {
  entry: ChannelProcessEntry
  target: Pick<ChannelProcessTarget, 'sessionType' | 'channelId'>
}) => {
  const db = getDb()
  const binding = db.getChannelSession(params.entry.type, params.entry.key, params.target.sessionType, params.target.channelId)
  if (binding?.sessionId == null) {
    return {
      archivedSessionIds: [] as string[],
      sessionId: undefined,
      context: resolveChannelContextSummary(params.entry, params.target)
    }
  }

  const updatedIds = db.updateSessionArchivedWithChildren(binding.sessionId, true)
  for (const updatedId of updatedIds) {
    const updatedSession = db.getSession(updatedId)
    if (updatedSession != null) {
      notifySessionUpdated(updatedId, updatedSession)
    }
  }

  db.deleteChannelSessionBySessionId(binding.sessionId)
  deleteBinding(binding.sessionId)

  return {
    archivedSessionIds: updatedIds,
    sessionId: binding.sessionId,
    context: resolveChannelContextSummary(params.entry, params.target)
  }
}

export const stopChannelSessionTarget = (params: {
  entry: ChannelProcessEntry
  target: Pick<ChannelProcessTarget, 'sessionType' | 'channelId'>
}) => {
  const db = getDb()
  const binding = db.getChannelSession(params.entry.type, params.entry.key, params.target.sessionType, params.target.channelId)
  if (binding?.sessionId == null) {
    return {
      stopped: false,
      sessionId: undefined,
      context: resolveChannelContextSummary(params.entry, params.target)
    }
  }

  killSession(binding.sessionId)
  return {
    stopped: true,
    sessionId: binding.sessionId,
    context: resolveChannelContextSummary(params.entry, params.target)
  }
}

export const restartChannelSessionTarget = async (params: {
  entry: ChannelProcessEntry
  target: Pick<ChannelProcessTarget, 'sessionType' | 'channelId'>
}) => {
  const db = getDb()
  const binding = db.getChannelSession(params.entry.type, params.entry.key, params.target.sessionType, params.target.channelId)
  if (binding?.sessionId == null) {
    return {
      restarted: false,
      sessionId: undefined,
      context: resolveChannelContextSummary(params.entry, params.target)
    }
  }

  killSession(binding.sessionId)
  await startAdapterSession(binding.sessionId)
  return {
    restarted: true,
    sessionId: binding.sessionId,
    context: resolveChannelContextSummary(params.entry, params.target)
  }
}

export const updateChannelPreferenceTarget = (params: {
  entry: ChannelProcessEntry
  target: Pick<ChannelProcessTarget, 'sessionType' | 'channelId'>
  updates: ChannelPreferencePatch
}) => {
  const hasUpdate = (
    'adapter' in params.updates ||
    'permissionMode' in params.updates ||
    'effort' in params.updates
  )
  if (!hasUpdate) {
    throw new Error('At least one of adapter, permissionMode or effort must be provided')
  }

  return {
    preference: writeChannelPreference(params),
    context: resolveChannelContextSummary(params.entry, params.target)
  }
}

const parseTarget = (value: unknown): ChannelProcessTarget => {
  const payload = asRecord(value)
  const sessionType = asString(payload?.sessionType)
  const channelId = asString(payload?.channelId)
  if (sessionType === '' || channelId === '') {
    throw new Error('target.sessionType and target.channelId are required')
  }

  const senderId = asString(payload?.senderId)
  const replyReceiveId = asString(payload?.replyReceiveId)
  const replyReceiveIdType = asString(payload?.replyReceiveIdType)

  return {
    sessionType,
    channelId,
    ...(senderId !== '' ? { senderId } : {}),
    ...(replyReceiveId !== '' ? { replyReceiveId } : {}),
    ...(replyReceiveIdType !== '' ? { replyReceiveIdType } : {})
  }
}

const createReplyCollector = () => {
  const replies: ExecuteChannelCommandResult['replies'] = []
  let index = 0

  return {
    replies,
    reply: async (text: string): Promise<ChannelSendResult> => {
      const messageId = `mdp-reply-${++index}`
      replies.push({ messageId, text })
      return { messageId }
    }
  }
}

const buildChannelContext = (params: {
  entry: ChannelProcessEntry
  config?: ChannelBaseConfig
  target: ChannelProcessTarget
  commandText: string
  reply: (text: string) => Promise<ChannelSendResult | undefined>
  pushFollowUps: ExecuteChannelCommandResult['followUps']
}): ChannelContext => {
  const db = getDb()
  const translate = createT(resolveLanguage(params.config))
  const binding = db.getChannelSession(params.entry.type, params.entry.key, params.target.sessionType, params.target.channelId)
  const preference = db.getChannelPreference(params.entry.type, params.entry.key, params.target.sessionType, params.target.channelId)

  return {
    channelKey: params.entry.key,
    configSource: params.entry.configSource,
    inbound: {
      channelType: params.entry.type,
      sessionType: params.target.sessionType,
      channelId: params.target.channelId,
      ...(params.target.senderId ? { senderId: params.target.senderId } : {}),
      ...(params.target.replyReceiveId
        ? {
          replyTo: {
            receiveId: params.target.replyReceiveId,
            receiveIdType: params.target.replyReceiveIdType ?? 'chat_id'
          }
        }
        : {}),
      raw: {
        source: 'mdp'
      }
    },
    connection: undefined,
    config: params.config,
    sessionId: binding?.sessionId,
    channelAdapter: preference?.adapter,
    channelPermissionMode: preference?.permissionMode,
    channelEffort: preference?.effort,
    contentItems: undefined,
    commandText: params.commandText,
    defineMessages: () => undefined,
    t: translate,
    reply: params.reply,
    pushFollowUps: async ({ messageId, followUps }) => {
      params.pushFollowUps.push({
        messageId,
        followUps: followUps.map(followUp => ({
          content: followUp.content,
          ...(followUp.i18nContents ? { i18nContents: [...followUp.i18nContents] } : {})
        }))
      })
    },
    getBoundSession: () => {
      if (binding?.sessionId == null) {
        return undefined
      }
      return db.getSession(binding.sessionId)
    },
    searchSessions: (query) => {
      return searchChannelSessions({
        entry: params.entry,
        query,
        target: params.target
      }).sessions.map(({ session, binding }) => ({
        session,
        ...(binding == null
          ? {}
          : {
            binding: {
              channelType: binding.channelType,
              sessionType: binding.sessionType,
              channelId: binding.channelId,
              channelKey: binding.channelKey
            }
          })
      }))
    },
    bindSession: (sessionId): ChannelBindSessionResult => {
      try {
        const result = bindChannelSessionTarget({
          entry: params.entry,
          target: params.target,
          sessionId
        })
        return {
          ...result.bindingResult,
          session: result.session
        }
      } catch {
        return { alreadyBound: false }
      }
    },
    unbindSession: () => {
      const currentBinding = db.getChannelSession(params.entry.type, params.entry.key, params.target.sessionType, params.target.channelId)
      const sessionId = currentBinding?.sessionId
      unbindChannelSessionTarget({
        entry: params.entry,
        target: params.target
      })
      return { sessionId }
    },
    resetSession: () => {
      resetChannelSessionTarget({
        entry: params.entry,
        target: params.target
      })
    },
    stopSession: () => {
      stopChannelSessionTarget({
        entry: params.entry,
        target: params.target
      })
    },
    restartSession: async () => {
      await restartChannelSessionTarget({
        entry: params.entry,
        target: params.target
      })
    },
    resolveSessionWorkspace: async (sessionId?: string): Promise<SessionWorkspace | undefined> => {
      const targetSessionId = sessionId ?? binding?.sessionId
      if (targetSessionId == null || targetSessionId === '') {
        return undefined
      }
      return await resolveSessionWorkspace(targetSessionId)
    },
    updateSession: (updates) => {
      if (binding?.sessionId == null) {
        return
      }
      db.updateSession(binding.sessionId, updates)
    },
    getChannelAdapterPreference: () => preference?.adapter,
    setChannelAdapterPreference: (adapter) => {
      writeChannelPreference({
        entry: params.entry,
        target: params.target,
        updates: {
          adapter
        }
      })
    },
    getChannelPermissionModePreference: () => preference?.permissionMode,
    setChannelPermissionModePreference: (permissionMode) => {
      writeChannelPreference({
        entry: params.entry,
        target: params.target,
        updates: {
          permissionMode
        }
      })
    },
    getChannelEffortPreference: () => preference?.effort,
    setChannelEffortPreference: (effort) => {
      writeChannelPreference({
        entry: params.entry,
        target: params.target,
        updates: {
          effort
        }
      })
    }
  }
}

export const executeChannelCommand = async (params: {
  entry: ChannelProcessEntry
  config?: ChannelBaseConfig
  input: unknown
}): Promise<ExecuteChannelCommandResult> => {
  ensureSharedCommandMessagesRegistered()
  const payload = asRecord(params.input)
  const command = asString(payload?.command)
  if (command === '') {
    throw new Error('command is required')
  }

  const target = parseTarget(payload?.target)
  const prefix = resolveCommandPrefix(params.config)
  const commands = createChannelCommands(prefix)
  const translate = createT(resolveLanguage(params.config))
  const parsed = parseCommandString(commands, command, {
    t: translate,
    prefix
  })

  const collector = createReplyCollector()
  const followUps: ExecuteChannelCommandResult['followUps'] = []
  const ctx = buildChannelContext({
    entry: params.entry,
    config: params.config,
    target,
    commandText: command,
    reply: collector.reply,
    pushFollowUps: followUps
  })

  if (!parsed.ok) {
    return {
      ok: false,
      code: parsed.code,
      message: parsed.message,
      usage: parsed.usage,
      replies: collector.replies,
      followUps,
      context: resolveChannelContextSummary(params.entry, target)
    }
  }

  if (parsed.command.permission === 'admin' && !isAdmin(ctx)) {
    return {
      ok: false,
      code: 'permission-denied',
      message: ctx.t('system.noPermission'),
      usage: parsed.usage,
      replies: collector.replies,
      followUps,
      context: resolveChannelContextSummary(params.entry, target)
    }
  }

  await parsed.command.action?.({
    ctx,
    args: [...parsed.args],
    rawArgs: parsed.rawArgs,
    commandPath: parsed.commandPath,
    usage: parsed.usage
  })

  return {
    ok: true,
    commandPath: [...parsed.commandPath],
    usage: parsed.usage,
    replies: collector.replies,
    followUps,
    context: resolveChannelContextSummary(params.entry, target)
  }
}
