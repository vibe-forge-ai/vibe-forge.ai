import { randomUUID } from 'node:crypto'
import { createMdpClient, type MdpClient } from '@modeldriveprotocol/client/node'
import { DefinitionLoader } from '@vibe-forge/definition-loader'
import { parseExpression } from 'cron-parser'
import { z } from 'zod'
import {
  buildRuntimeClientId,
  connectRuntimeClients,
  createUniquePathSegments,
  disconnectRuntimeClients,
  resolveMdpConfig,
  type RuntimeClientHandle
} from '@vibe-forge/mdp'
import type {
  Config,
  GitBranchKind,
  GitCommitPayload,
  GitPushPayload,
  SessionInfo,
  SessionInitInfo,
  SessionPromptType,
  WorktreeEnvironmentSavePayload,
  WorktreeEnvironmentSource
} from '@vibe-forge/types'
import type {
  EffortLevel,
  ChatMessage,
  ChatMessageContent,
  SessionQueuedMessageMode,
  SessionWorkspaceFileState,
  WSEvent
} from '@vibe-forge/core'
import type { ChannelFileMessage, ChannelFollowUp } from '@vibe-forge/core/channel'
import { AskUserQuestionParamsSchema } from '@vibe-forge/core/schema'

import { listChannelRuntimeStates } from '#~/channels/index.js'
import { loadChannelModule } from '#~/channels/loader.js'
import { resolveBinding } from '#~/channels/state.js'
import type { ChannelRuntimeState } from '#~/channels/types.js'
import type {
  AutomationBranchMode,
  AutomationRule,
  AutomationTask,
  AutomationTrigger
} from '#~/db/automation/repo.js'
import { getDb } from '#~/db/index.js'
import {
  matchesDefinitionPath,
  presentEntity,
  presentEntityDetail,
  presentRule,
  presentRuleDetail,
  presentSpec,
  presentSpecDetail,
  presentWorkspace
} from '#~/routes/ai-presenters.js'
import {
  getBenchmarkCaseDetail,
  getBenchmarkResultDetail,
  getBenchmarkRunDetail,
  listBenchmarkCaseSummaries,
  listBenchmarkCategorySummaries,
  listBenchmarkResultSummaries,
  startBenchmarkRun
} from '#~/services/benchmark/index.js'
import {
  loadConfigResponse,
  loadConfigSchemaResponse,
  generateWorkspaceConfigSchema,
  updateConfigSectionAndReload
} from '#~/services/config/api.js'
import { getWorkspaceFolder, loadConfigState } from '#~/services/config/index.js'
import {
  deleteWorktreeEnvironment,
  getWorktreeEnvironment,
  listWorktreeEnvironments,
  saveWorktreeEnvironment
} from '#~/services/worktree-environments.js'
import { requestInteraction } from '#~/services/session/interaction.js'
import { resolvePermissionDecision, resolvePermissionSubjectFromInput } from '#~/services/session/permission.js'
import { createSessionWithInitialMessage } from '#~/services/session/create.js'
import { applySessionEvent } from '#~/services/session/events.js'
import { branchSessionFromMessage } from '#~/services/session/history.js'
import { killSession, processUserMessage, updateAndNotifySession } from '#~/services/session/index.js'
import {
  bindChannelSessionTarget,
  executeChannelCommand,
  restartChannelSessionTarget,
  resetChannelSessionTarget,
  resolveChannelCommandCatalog,
  resolveChannelContexts,
  searchChannelSessions,
  stopChannelSessionTarget,
  unbindChannelSessionTarget,
  updateChannelPreferenceTarget,
  type ChannelProcessEntry
} from '#~/services/mdp/channel-process.js'
import { renderSummaryLines, summarizeSchema } from '#~/services/mdp/schema-summary.js'
import { handleInteractionResponse, setSessionInteraction, getSessionInteraction } from '#~/services/session/interaction.js'
import {
  createSessionQueuedMessage,
  deleteSessionQueuedMessage,
  listSessionQueuedMessages,
  moveSessionQueuedMessage,
  reorderSessionQueuedMessages,
  updateSessionQueuedMessage
} from '#~/services/session/queue.js'
import { broadcastSessionEvent, notifySessionUpdated } from '#~/services/session/runtime.js'
import {
  createSessionManagedWorktree,
  deleteSessionWorkspace,
  provisionSessionWorkspace,
  resolveSessionWorkspace,
  resolveSessionWorkspaceFolder,
  transferSessionWorkspaceToLocal
} from '#~/services/session/workspace.js'
import { disposeTerminalSession } from '#~/services/terminal/index.js'
import {
  checkoutSessionGitBranch,
  commitSessionGitChanges,
  createSessionGitBranch,
  getSessionGitState,
  getWorkspaceGitState,
  listSessionGitBranches,
  listSessionGitWorktrees,
  listWorkspaceGitBranches,
  listWorkspaceGitWorktrees,
  pushSessionGitBranch,
  syncSessionGitBranch
} from '#~/services/git/index.js'
import { readWorkspaceFile, resolveWorkspaceImageResource, updateWorkspaceFile } from '#~/services/workspace/file.js'
import { listWorkspaceTree } from '#~/services/workspace/tree.js'
import {
  initAutomationScheduler,
  removeAutomationRuleSchedule,
  runAutomationRule,
  scheduleAutomationRule
} from '#~/services/automation/index.js'
import { badRequest, conflict, notFound, requestTimeout } from '#~/utils/http.js'
import { logger } from '#~/utils/logger.js'

interface ServerMdpRuntimeHandle {
  stop(): Promise<void>
}

let activeRuntime: ServerMdpRuntimeHandle | null = null
let automationSchedulerReady = false

export const stopServerMdpRuntime = async () => {
  if (activeRuntime == null) {
    return
  }

  const runtime = activeRuntime
  activeRuntime = null
  await runtime.stop()
}

interface ChannelPathEntry extends ChannelProcessEntry {
  status: 'connected' | 'disabled' | 'error'
  error?: string
  capabilities: {
    sendMessage: boolean
    updateMessage: boolean
    sendFileMessage: boolean
    pushFollowUps: boolean
  }
}

type ConnectedChannelRuntimeState = ChannelRuntimeState & {
  status: 'connected'
  connection: NonNullable<ChannelRuntimeState['connection']>
}

type JsonObject = Record<string, unknown>

const asRecord = (value: unknown): JsonObject | undefined => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
    ? value as JsonObject
    : undefined
)

const asString = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const asBoolean = (value: unknown) => value === true || value === 'true'
const asStringArray = (value: unknown) => (
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : []
)

const asOptionalNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

const ensureAutomationScheduler = () => {
  if (automationSchedulerReady) {
    return
  }

  initAutomationScheduler()
  automationSchedulerReady = true
}

const parseChannelFileMessage = (value: unknown): ChannelFileMessage => {
  const payload = asRecord(value)
  const receiveId = asString(payload?.receiveId)
  const receiveIdType = asString(payload?.receiveIdType)
  const fileName = asString(payload?.fileName)
  const content = payload?.content

  if (receiveId === '' || receiveIdType === '' || fileName === '') {
    throw new Error('receiveId, receiveIdType and fileName are required')
  }
  if (typeof content !== 'string') {
    throw new Error('content must be a UTF-8 string')
  }

  return {
    receiveId,
    receiveIdType,
    fileName,
    content
  }
}

const parseChannelFollowUps = (value: unknown): { messageId: string; followUps: ChannelFollowUp[] } => {
  const payload = asRecord(value)
  const messageId = asString(payload?.messageId)
  if (messageId === '') {
    throw new Error('messageId is required')
  }

  if (!Array.isArray(payload?.followUps)) {
    throw new Error('followUps must be an array')
  }

  const followUps = payload.followUps.map((entry) => {
    const item = asRecord(entry)
    const content = asString(item?.content)
    if (content === '') {
      throw new Error('each followUp requires content')
    }

    const i18nContents = Array.isArray(item?.i18nContents)
      ? item.i18nContents.flatMap((candidate) => {
        const translated = asRecord(candidate)
        const translatedContent = asString(translated?.content)
        const language = asString(translated?.language)
        if (translatedContent === '' || language === '') {
          return []
        }
        return [{ content: translatedContent, language }]
      })
      : undefined

    return {
      content,
      ...(i18nContents != null && i18nContents.length > 0 ? { i18nContents } : {})
    }
  })

  return { messageId, followUps }
}

const sanitizeMdpConfig = (config: Config['mdp']) => {
  const resolved = resolveMdpConfig({ mdp: config })
  return {
    ...resolved,
    connections: resolved.connections.map((connection) => ({
    key: connection.key,
    title: connection.title,
    description: connection.description,
    hosts: connection.hosts
    }))
  }
}

const sessionPermissionModeSchema = z.enum([
  'default',
  'acceptEdits',
  'plan',
  'dontAsk',
  'bypassPermissions'
])

const sessionEffortSchema = z.enum([
  'low',
  'medium',
  'high',
  'max'
])

const channelTargetSchema = z.object({
  sessionType: z.string().min(1).describe('Channel session type, for example direct or group'),
  channelId: z.string().min(1).describe('Concrete channel context identifier'),
  senderId: z.string().optional().describe('Optional sender identity used for admin checks'),
  replyReceiveId: z.string().optional().describe('Optional reply target receive_id'),
  replyReceiveIdType: z.string().optional().describe('Optional reply target receive_id_type')
})

const channelTargetRequestSchema = z.object({
  target: channelTargetSchema
})

const channelCommandInputSchema = z.object({
  command: z.string().min(1).describe('Command text including the channel command prefix'),
  target: channelTargetSchema
})

const channelBindSessionSchema = z.object({
  target: channelTargetSchema,
  sessionId: z.string().min(1).describe('Existing Vibe Forge session id to bind into this channel context')
})

const channelSearchSessionsQuerySchema = z.object({
  query: z.string().optional().describe('Optional free-text filter for session id, title, model or tags'),
  limit: z.string().optional().describe('Optional maximum number of sessions to return'),
  offset: z.string().optional().describe('Optional pagination offset')
})

const channelPreferencePatchSchema = z.object({
  target: channelTargetSchema,
  adapter: z.string().min(1).nullable().optional().describe('Explicit adapter for the next channel-created session; use null to clear'),
  permissionMode: sessionPermissionModeSchema.nullable().optional().describe('Explicit permission mode; use null to clear'),
  effort: sessionEffortSchema.nullable().optional().describe('Explicit effort; use null to clear')
}).refine((value) => (
  'adapter' in value ||
  'permissionMode' in value ||
  'effort' in value
), {
  message: 'At least one of adapter, permissionMode or effort must be provided'
})

const channelSendFileSchema = z.object({
  receiveId: z.string().min(1).describe('Target receive_id'),
  receiveIdType: z.string().min(1).describe('Target receive_id_type'),
  fileName: z.string().min(1).describe('Filename shown in the channel'),
  content: z.string().min(1).describe('UTF-8 file content')
})

const channelPushFollowUpsSchema = z.object({
  messageId: z.string().min(1).describe('Target channel message id'),
  followUps: z.array(z.object({
    content: z.string().min(1).describe('Follow-up text'),
    i18nContents: z.array(z.object({
      content: z.string().min(1).describe('Localized follow-up text'),
      language: z.string().min(1).describe('Language code')
    })).optional().describe('Optional localized variants')
  })).min(1).describe('Ordered follow-up items')
})

type NormalizedAutomationTrigger = Omit<AutomationTrigger, 'createdAt' | 'ruleId'>
type NormalizedAutomationTask = Omit<AutomationTask, 'createdAt' | 'ruleId'>

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized === '' ? null : normalized
}

const normalizeEffort = (value: unknown): EffortLevel | null => {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'max' ? value : null
}

const normalizePermissionMode = (value: unknown): AutomationTask['permissionMode'] => {
  return value === 'default' ||
      value === 'acceptEdits' ||
      value === 'plan' ||
      value === 'dontAsk' ||
      value === 'bypassPermissions'
    ? value
    : null
}

const normalizeBranchKind = (value: unknown): GitBranchKind | null => {
  return value === 'local' || value === 'remote' ? value : null
}

const normalizeBranchMode = (value: unknown): AutomationBranchMode | null => {
  return value === 'checkout' || value === 'create' ? value : null
}

const normalizeTaskLaunchOptions = (task: Partial<AutomationTask>) => {
  const branchName = normalizeOptionalString(task.branchName)
  const branchMode = normalizeBranchMode(task.branchMode)
  const normalizedBranchMode = branchName == null ? null : branchMode ?? 'checkout'

  return {
    model: normalizeOptionalString(task.model),
    adapter: normalizeOptionalString(task.adapter),
    effort: normalizeEffort(task.effort),
    permissionMode: normalizePermissionMode(task.permissionMode),
    createWorktree: typeof task.createWorktree === 'boolean' ? task.createWorktree : null,
    branchName,
    branchMode: normalizedBranchMode,
    branchKind: branchName == null || normalizedBranchMode === 'create'
      ? null
      : normalizeBranchKind(task.branchKind) ?? 'local'
  }
}

const isValidCronExpression = (expression?: string | null) => {
  if (!expression) return false
  try {
    parseExpression(expression)
    return true
  } catch {
    return false
  }
}

const normalizeAutomationTrigger = (
  trigger: Partial<AutomationTrigger>
): NormalizedAutomationTrigger => {
  const type: AutomationTrigger['type'] = trigger.type === 'webhook'
    ? 'webhook'
    : trigger.type === 'cron'
    ? 'cron'
    : 'interval'
  const intervalMs = trigger.intervalMs ?? null
  const cronExpression = (trigger.cronExpression ?? '').trim()
  const webhookKey = (trigger.webhookKey ?? '').trim()

  if (type === 'interval' && (intervalMs == null || intervalMs <= 0)) {
    throw badRequest('Invalid interval', undefined, 'invalid_interval')
  }
  if (type === 'cron' && !isValidCronExpression(cronExpression)) {
    throw badRequest('Invalid cron expression', undefined, 'invalid_cron_expression')
  }

  return {
    id: trigger.id ?? randomUUID(),
    type,
    intervalMs: type === 'interval' ? intervalMs : null,
    cronExpression: type === 'cron' ? cronExpression : null,
    webhookKey: type === 'webhook' ? (webhookKey !== '' ? webhookKey : randomUUID()) : null
  }
}

const normalizeAutomationTask = (task: Partial<AutomationTask>, index: number): NormalizedAutomationTask => {
  const title = (task.title ?? '').trim() || `任务 ${index + 1}`
  const prompt = (task.prompt ?? '').trim()
  if (prompt === '') {
    throw badRequest('Invalid task prompt', undefined, 'invalid_task_prompt')
  }

  return {
    id: task.id ?? randomUUID(),
    title,
    prompt,
    ...normalizeTaskLaunchOptions(task)
  }
}

const buildServerSkillContent = () => [
  '# Server Runtime',
  '',
  'This client exposes Vibe Forge server domains without an extra product prefix.',
  '',
  'Open the focused group skill you need:',
  '- `/sessions/skill.md`',
  '- `/workspace/skill.md`',
  '- `/worktree-environments/skill.md`',
  '- `/automation/skill.md`',
  '- `/benchmark/skill.md`',
  '- `/config/skill.md`',
  '- `/catalog/skill.md`',
  '- `/interactions/skill.md`'
].join('\n')

const buildServerSessionsSkillContent = () => [
  '# Sessions',
  '',
  '- `GET /sessions`',
  '- `GET /sessions/archived`',
  '- `POST /sessions/create`',
  '- `GET /sessions/:session_id`',
  '- `GET /sessions/:session_id/messages`',
  '- `POST /sessions/:session_id/update`',
  '- `POST /sessions/:session_id/delete`',
  '- `POST /sessions/:session_id/fork`',
  '- `POST /sessions/:session_id/messages/:message_id/branch`',
  '- `POST /sessions/:session_id/events/publish`',
  '- `GET /sessions/:session_id/queued-messages` and related mutation paths',
  '- `GET /sessions/:session_id/workspace` and `/sessions/:session_id/workspace/skill.md`',
  '- `GET /sessions/:session_id/git/state` and `/sessions/:session_id/git/skill.md`'
].join('\n')

const buildServerWorkspaceSkillContent = () => [
  '# Workspace',
  '',
  '- `GET /workspace/tree`',
  '- `GET /workspace/file`',
  '- `POST /workspace/file/update`',
  '- `GET /workspace/resource`',
  '- `GET /workspace/git/state`',
  '- `GET /workspace/git/branches`',
  '- `GET /workspace/git/worktrees`'
].join('\n')

const buildServerWorktreeEnvironmentsSkillContent = () => [
  '# Worktree Environments',
  '',
  '- `GET /worktree-environments`',
  '- `GET /worktree-environments/:id`',
  '- `POST /worktree-environments/:id/save`',
  '- `POST /worktree-environments/:id/delete`'
].join('\n')

const buildServerAutomationSkillContent = () => [
  '# Automation',
  '',
  '- `GET /automation/rules`',
  '- `POST /automation/rules/create`',
  '- `POST /automation/rules/:id/update`',
  '- `POST /automation/rules/:id/delete`',
  '- `POST /automation/rules/:id/run`',
  '- `GET /automation/rules/:id/runs`'
].join('\n')

const buildServerBenchmarkSkillContent = () => [
  '# Benchmark',
  '',
  '- `GET /benchmark/categories`',
  '- `GET /benchmark/cases`',
  '- `GET /benchmark/cases/:category/:title`',
  '- `GET /benchmark/results`',
  '- `GET /benchmark/results/:category/:title`',
  '- `GET /benchmark/runs/:run_id`',
  '- `POST /benchmark/run`'
].join('\n')

const buildServerConfigSkillContent = () => [
  '# Config',
  '',
  '- `GET /config`',
  '- `GET /config/schema`',
  '- `POST /config/schema/generate`',
  '- `POST /config/update`'
].join('\n')

const buildServerCatalogSkillContent = () => [
  '# Catalog',
  '',
  '- `GET /catalog/specs`',
  '- `GET /catalog/specs/detail`',
  '- `GET /catalog/entities`',
  '- `GET /catalog/entities/detail`',
  '- `GET /catalog/rules`',
  '- `GET /catalog/rules/detail`',
  '- `GET /catalog/workspaces`'
].join('\n')

const buildServerInteractionsSkillContent = () => [
  '# Interactions',
  '',
  '- `POST /interactions/ask`',
  '- `POST /interactions/permission-check`'
].join('\n')

const buildChannelsSkillContent = (entries: ChannelPathEntry[]) => {
  if (entries.length === 0) {
    return [
      '# Channel Runtime',
      '',
      'No channel runtimes are currently configured.'
    ].join('\n')
  }

  return [
    '# Channel Runtime',
    '',
    'Open the type skill first, then drill into one concrete channel instance:',
    '',
    ...Array.from(new Set(entries.map(entry => entry.type))).map((type) => `- \`/${type}/skill.md\``),
    '',
    'Available channel instances:',
    '',
    ...entries.map((entry) => {
      const capabilities = [
        entry.capabilities.sendMessage ? 'send-message' : undefined,
        entry.capabilities.updateMessage ? 'update-message' : undefined,
        entry.capabilities.sendFileMessage ? 'send-file' : undefined,
        entry.capabilities.pushFollowUps ? 'push-follow-ups' : undefined
      ].filter((capability): capability is string => capability != null)

      return [
        `- \`/${entry.type}/${entry.instanceKey}/skill.md\``,
        `  title: ${entry.title ?? entry.label}`,
        `  status: ${entry.status}`,
        ...(entry.description ? [`  description: ${entry.description}`] : []),
        `  capabilities: ${capabilities.length > 0 ? capabilities.join(', ') : 'read-only'}`
      ].join('\n')
    })
  ].join('\n')
}

const buildChannelTypeSkillContent = (type: string, entries: ChannelPathEntry[]) => {
  const mod = loadChannelModule(type)
  return [
    `# ${mod.definition.label}`,
    '',
    mod.definition.description,
    '',
    'Available instances:',
    '',
    ...entries
      .filter(entry => entry.type === type)
      .map((entry) => `- \`/${type}/${entry.instanceKey}/skill.md\`${entry.title ? `: ${entry.title}` : ''}`)
  ].join('\n')
}

const buildChannelSkillContent = (entry: ChannelPathEntry) => {
  const basePath = `/${entry.type}/${entry.instanceKey}`
  const mod = loadChannelModule(entry.type)
  const lines = [
    `# ${entry.title ?? entry.label}`,
    '',
    'Use this order:',
    '1. Read `/state` and `/contexts` to discover the concrete runtime state and available targets.',
    '2. Prefer direct endpoints such as `/bind-session`, `/preferences`, `/send-message` and `/stop-session` when they exist.',
    '3. Use `/commands` and `/run-command` only as a fallback for operations that do not have a structured path yet.',
    '',
    `- State: \`GET ${basePath}/state\``,
    `- Bindings: \`GET ${basePath}/bindings\``,
    `- Contexts: \`GET ${basePath}/contexts\``,
    `- Search sessions: \`GET ${basePath}/search-sessions\``,
    `- Commands: \`GET ${basePath}/commands\``,
    `- Schemas: \`GET ${basePath}/schemas\``,
    `- Bind session: \`POST ${basePath}/bind-session\``,
    `- Unbind session: \`POST ${basePath}/unbind-session\``,
    `- Reset session tree: \`POST ${basePath}/reset-session\``,
    `- Stop session: \`POST ${basePath}/stop-session\``,
    `- Restart session: \`POST ${basePath}/restart-session\``,
    `- Update preferences: \`POST ${basePath}/preferences\``,
    `- Run command: \`POST ${basePath}/run-command\``,
    `- Status: \`${entry.status}\``
  ]

  if (entry.capabilities.sendMessage) {
    lines.push(`- Send message: \`POST ${basePath}/send-message\``)
  }
  if (entry.capabilities.updateMessage) {
    lines.push(`- Update message: \`POST ${basePath}/update-message\``)
  }
  if (entry.capabilities.sendFileMessage) {
    lines.push(`- Send file: \`POST ${basePath}/send-file\``)
  }
  if (entry.capabilities.pushFollowUps) {
    lines.push(`- Push follow-ups: \`POST ${basePath}/push-follow-ups\``)
  }
  if (entry.error) {
    lines.push('', `Current error: ${entry.error}`)
  }

  lines.push(
    '',
    'For `search-sessions`, use query parameters like:',
    '```text',
    `${basePath}/search-sessions?query=bugfix&limit=10&offset=0`,
    '```',
    '',
    'For `bind-session`, pass a body like:',
    '```json',
    '{',
    '  "sessionId": "<session-id>",',
    '  "target": {',
    '    "sessionType": "direct",',
    '    "channelId": "<channel-id>"',
    '  }',
    '}',
    '```',
    '',
    'For `preferences`, pass a body like:',
    '```json',
    '{',
    '  "target": {',
    '    "sessionType": "direct",',
    '    "channelId": "<channel-id>"',
    '  },',
    '  "permissionMode": "dontAsk",',
    '  "effort": "high"',
    '}',
    '```',
    '',
    'Only use `run-command` for commands that do not have a dedicated path yet. Pass a body like:',
    '```json',
    '{',
    '  "command": "/help session",',
    '  "target": {',
    '    "sessionType": "direct",',
    '    "channelId": "<channel-id>"',
    '  }',
    '}',
    '```'
  )

  lines.push(
    '',
    `The concrete request shapes are available from \`${basePath}/schemas\`.`
  )

  lines.push(
    '',
    ...renderSummaryLines('Bind Session Body', channelBindSessionSchema),
    '',
    ...renderSummaryLines('Preference Patch Body', channelPreferencePatchSchema),
    '',
    ...renderSummaryLines('Run Command Body', channelCommandInputSchema)
  )

  if (entry.capabilities.sendMessage) {
    lines.push(
      '',
      ...renderSummaryLines('Send Message Body', mod.definition.messageSchema)
    )
  }

  return lines.join('\n')
}

const resolveChannelPathEntries = () => {
  const states = listChannelRuntimeStates()
  const groupedKeys = new Map<string, string[]>()

  for (const state of states) {
    const keys = groupedKeys.get(state.type) ?? []
    keys.push(state.key)
    groupedKeys.set(state.type, keys)
  }

  const groupedSegments = new Map<string, Map<string, string>>()
  for (const [type, keys] of groupedKeys.entries()) {
    const segments = createUniquePathSegments(keys)
    groupedSegments.set(type, new Map(keys.map((key, index) => [key, segments[index]])))
  }

  return states.map((state) => {
    let label = state.type
    let description = state.config?.description
    try {
      const mod = loadChannelModule(state.type)
      label = mod.definition.label
      description = state.config?.description ?? mod.definition.description
    } catch {}

    const instanceKey = groupedSegments.get(state.type)?.get(state.key) ?? state.key

    return {
      key: state.key,
      instanceKey,
      type: state.type,
      label,
      title: state.config?.title,
      description,
      status: state.status,
      configSource: state.configSource,
      error: state.error,
      capabilities: {
        sendMessage: state.connection != null,
        updateMessage: typeof state.connection?.updateMessage === 'function',
        sendFileMessage: typeof state.connection?.sendFileMessage === 'function',
        pushFollowUps: typeof state.connection?.pushFollowUps === 'function'
      }
    } satisfies ChannelPathEntry
  })
}

const resolveChannelPathEntry = (type: string, instanceKey: string) => (
  resolveChannelPathEntries().find(entry => entry.type === type && entry.instanceKey === instanceKey)
)

const resolveChannelRuntimeState = (entry: ChannelPathEntry) => (
  listChannelRuntimeStates().find(candidate => candidate.key === entry.key)
)

const resolveChannelSchemas = (entry: ChannelPathEntry) => {
  const mod = loadChannelModule(entry.type)
  return {
    channel: {
      type: mod.definition.type,
      label: mod.definition.label,
      description: mod.definition.description
    },
    searchSessionsQuery: summarizeSchema(channelSearchSessionsQuerySchema),
    bindSession: summarizeSchema(channelBindSessionSchema),
    unbindSession: summarizeSchema(channelTargetRequestSchema),
    resetSession: summarizeSchema(channelTargetRequestSchema),
    stopSession: summarizeSchema(channelTargetRequestSchema),
    restartSession: summarizeSchema(channelTargetRequestSchema),
    preferences: summarizeSchema(channelPreferencePatchSchema),
    ...(entry.capabilities.sendMessage
      ? {
        sendMessage: summarizeSchema(mod.definition.messageSchema)
      }
      : {}),
    runCommand: summarizeSchema(channelCommandInputSchema),
    ...(entry.capabilities.updateMessage
      ? {
        updateMessage: summarizeSchema(z.object({
          messageId: z.string().min(1).describe('Existing channel message id'),
          message: mod.definition.messageSchema
        }))
      }
      : {}),
    ...(entry.capabilities.sendFileMessage
      ? {
        sendFile: summarizeSchema(channelSendFileSchema)
      }
      : {}),
    ...(entry.capabilities.pushFollowUps
      ? {
        pushFollowUps: summarizeSchema(channelPushFollowUpsSchema)
      }
      : {})
  }
}

const resolveChannelBindings = (entry: ChannelPathEntry) => {
  const db = getDb()
  return {
    sessions: db.listChannelSessions({
      channelKey: entry.key,
      channelType: entry.type
    }),
    preferences: db.listChannelPreferences({
      channelKey: entry.key,
      channelType: entry.type
    })
  }
}

const requireConnectedChannelState = (entry: ChannelPathEntry) => {
  const state = listChannelRuntimeStates().find(candidate => candidate.key === entry.key)
  if (state?.status !== 'connected' || state.connection == null) {
    throw new Error(`Channel ${entry.key} is not connected`)
  }
  return state as ConnectedChannelRuntimeState
}

const createServerConfigSummary = async () => {
  const { workspaceFolder, mergedConfig } = await loadConfigState()
  return {
    workspaceFolder,
    baseDir: mergedConfig.baseDir,
    defaultAdapter: mergedConfig.defaultAdapter,
    defaultModelService: mergedConfig.defaultModelService,
    defaultModel: mergedConfig.defaultModel,
    adapters: Object.keys(mergedConfig.adapters ?? {}),
    modelServices: Object.keys(mergedConfig.modelServices ?? {}),
    channels: resolveChannelPathEntries(),
    mdp: sanitizeMdpConfig(mergedConfig.mdp)
  }
}

const getSessionDetail = (sessionId: string) => {
  const db = getDb()
  const session = db.getSession(sessionId)
  if (session == null) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  return {
    session,
    runtime: db.getSessionRuntimeState(sessionId),
    workspace: db.getSessionWorkspace(sessionId),
    interaction: getSessionInteraction(sessionId),
    binding: resolveBinding(sessionId)
  }
}

const ENVIRONMENT_ID_PATTERN = /^\w[\w.-]{0,127}$/

const assertEnvironmentId = (id: string | undefined) => {
  if (id == null || id.trim() === '') {
    throw badRequest('Worktree environment id is required', { id }, 'worktree_environment_id_required')
  }
  const normalized = id.trim()
  if (!ENVIRONMENT_ID_PATTERN.test(normalized)) {
    throw badRequest('Invalid worktree environment id', { id }, 'worktree_environment_id_invalid')
  }
  return normalized
}

const getEnvironmentSource = (value: unknown): WorktreeEnvironmentSource | undefined => {
  if (value === 'project' || value === 'user') {
    return value
  }
  return undefined
}

const readWorkspaceResourceSummary = async (
  path: string | undefined,
  options?: { workspaceFolder?: string }
) => {
  const resource = await resolveWorkspaceImageResource(path, options)
  return {
    filePath: resource.filePath,
    mimeType: resource.mimeType,
    size: resource.size
  }
}

const createServerClientHandles = async (params: {
  workspaceFolder: string
  mergedConfig: Config | undefined
}) => {
  const mdp = resolveMdpConfig(params.mergedConfig)
  return await connectRuntimeClients<MdpClient>({
    mdp,
    buildClientInfo: (connection) => ({
      id: buildRuntimeClientId([
        'server',
        connection.key,
        params.workspaceFolder,
        String(process.pid)
      ]),
      name: 'Vibe Forge Server',
      description: 'Vibe Forge server runtime',
      metadata: {
        component: 'server',
        connectionKey: connection.key,
        workspaceFolder: params.workspaceFolder
      }
    }),
    configureClient: (client) => {
      const invalidPayload = () => badRequest('Invalid payload', undefined, 'invalid_payload')
      const loadDefinitionLoader = () => new DefinitionLoader(getWorkspaceFolder())
      const sessionWorkspaceSkill = [
        '# Session Workspace',
        '',
        '- `GET /sessions/:session_id/workspace`',
        '- `GET /sessions/:session_id/workspace/tree`',
        '- `GET /sessions/:session_id/workspace/file`',
        '- `POST /sessions/:session_id/workspace/file/update`',
        '- `GET /sessions/:session_id/workspace/resource`',
        '- `POST /sessions/:session_id/workspace/create-worktree`',
        '- `POST /sessions/:session_id/workspace/transfer-local`'
      ].join('\n')
      const sessionGitSkill = [
        '# Session Git',
        '',
        '- `GET /sessions/:session_id/git/state`',
        '- `GET /sessions/:session_id/git/branches`',
        '- `GET /sessions/:session_id/git/worktrees`',
        '- `POST /sessions/:session_id/git/checkout`',
        '- `POST /sessions/:session_id/git/branch/create`',
        '- `POST /sessions/:session_id/git/commit`',
        '- `POST /sessions/:session_id/git/push`',
        '- `POST /sessions/:session_id/git/sync`'
      ].join('\n')

      client.expose('/skill.md', buildServerSkillContent())
      client.expose('/sessions/skill.md', buildServerSessionsSkillContent())
      client.expose('/workspace/skill.md', buildServerWorkspaceSkillContent())
      client.expose('/worktree-environments/skill.md', buildServerWorktreeEnvironmentsSkillContent())
      client.expose('/automation/skill.md', buildServerAutomationSkillContent())
      client.expose('/benchmark/skill.md', buildServerBenchmarkSkillContent())
      client.expose('/config/skill.md', buildServerConfigSkillContent())
      client.expose('/catalog/skill.md', buildServerCatalogSkillContent())
      client.expose('/interactions/skill.md', buildServerInteractionsSkillContent())

      client.expose('/sessions', {
        method: 'GET',
        description: 'List Vibe Forge sessions.'
      }, ({ queries }) => {
        const filter = asString(queries.filter)
        const normalizedFilter = filter === 'all' || filter === 'archived' ? filter : 'active'
        return {
          sessions: getDb().getSessions(normalizedFilter)
        }
      })
      client.expose('/sessions/archived', {
        method: 'GET',
        description: 'List archived Vibe Forge sessions.'
      }, () => ({
        sessions: getDb().getSessions('archived')
      }))
      client.expose('/sessions/create', {
        method: 'POST',
        description: 'Create a new session with optional initial message and workspace settings.'
      }, async ({ body }) => {
        const payload = asRecord(body) ?? {}
        const workspace = asRecord(payload.workspace)
        const branch = asRecord(workspace?.branch)
        const session = await createSessionWithInitialMessage({
          id: asString(payload.id) || undefined,
          title: asString(payload.title) || undefined,
          initialMessage: asString(payload.initialMessage) || undefined,
          initialContent: Array.isArray(payload.initialContent)
            ? payload.initialContent as ChatMessageContent[]
            : undefined,
          parentSessionId: asString(payload.parentSessionId) || undefined,
          shouldStart: payload.start !== false,
          model: asString(payload.model) || undefined,
          effort: normalizeEffort(payload.effort) ?? undefined,
          promptType: asString(payload.promptType) as SessionPromptType,
          promptName: asString(payload.promptName) || undefined,
          permissionMode: normalizePermissionMode(payload.permissionMode) ?? undefined,
          adapter: asString(payload.adapter) || undefined,
          workspace: workspace == null
            ? undefined
            : {
              createWorktree: asBoolean(workspace.createWorktree),
              worktreeEnvironment: asString(workspace.worktreeEnvironment) || undefined,
              branch: asString(branch?.name) === ''
                ? undefined
                : {
                  name: asString(branch?.name),
                  kind: asString(branch?.kind) as GitBranchKind,
                  mode: asString(branch?.mode) === 'create' ? 'create' : 'checkout'
                }
            }
        })
        return { session }
      })
      client.expose('/sessions/:session_id', {
        method: 'GET',
        description: 'Inspect a single session.'
      }, ({ params: requestParams }) => getSessionDetail(asString(requestParams.session_id)))
      client.expose('/sessions/:session_id/messages', {
        method: 'GET',
        description: 'Inspect session messages.'
      }, ({ params: requestParams, queries }) => {
        const sessionId = asString(requestParams.session_id)
        const messages = getDb().getMessages(sessionId)
        const limit = asOptionalNumber(queries.limit)
        return {
          session: getDb().getSession(sessionId),
          interaction: getSessionInteraction(sessionId),
          queuedMessages: listSessionQueuedMessages(sessionId),
          messages: limit == null ? messages : messages.slice(-limit)
        }
      })
      client.expose('/sessions/:session_id/update', {
        method: 'POST',
        description: 'Update session title, star state, archive state, tags or workspace file state.'
      }, ({ params: requestParams, body }) => {
        const sessionId = asString(requestParams.session_id)
        const payload = asRecord(body) ?? {}
        const title = typeof payload.title === 'string' ? payload.title : undefined
        const isStarred = typeof payload.isStarred === 'boolean' ? payload.isStarred : undefined
        const isArchived = typeof payload.isArchived === 'boolean' ? payload.isArchived : undefined
        const tags = Array.isArray(payload.tags) ? asStringArray(payload.tags) : undefined
        const workspaceFileState = payload.workspaceFileState as SessionWorkspaceFileState | undefined
        const db = getDb()

        if (title !== undefined || isStarred !== undefined || workspaceFileState !== undefined) {
          updateAndNotifySession(sessionId, { title, isStarred, workspaceFileState })
        }
        if (isArchived !== undefined) {
          const updatedIds = db.updateSessionArchivedWithChildren(sessionId, isArchived)
          for (const updatedId of updatedIds) {
            const updatedSession = db.getSession(updatedId)
            if (updatedSession != null) {
              notifySessionUpdated(updatedId, updatedSession)
            }
          }
        }
        if (tags !== undefined) {
          db.updateSessionTags(sessionId, tags)
          const updatedSession = db.getSession(sessionId)
          if (updatedSession != null) {
            notifySessionUpdated(sessionId, updatedSession)
          }
        }

        return {
          ok: true,
          session: db.getSession(sessionId)
        }
      })
      client.expose('/sessions/:session_id/delete', {
        method: 'POST',
        description: 'Delete one session, dispose its runtime and remove its workspace.'
      }, async ({ params: requestParams, body }) => {
        const sessionId = asString(requestParams.session_id)
        const force = asBoolean(asRecord(body)?.force)
        const db = getDb()

        killSession(sessionId)
        disposeTerminalSession(sessionId)
        await deleteSessionWorkspace(sessionId, { force })
        db.deleteChannelSessionBySessionId(sessionId)
        const removed = db.deleteSession(sessionId)
        if (removed) {
          notifySessionUpdated(sessionId, { id: sessionId, isDeleted: true })
        }
        return { ok: true, removed }
      })
      client.expose('/sessions/:session_id/events/publish', {
        method: 'POST',
        description: 'Publish a synthetic session event into the runtime.'
      }, ({ params: requestParams, body }) => {
        const sessionId = asString(requestParams.session_id)
        const existing = getDb().getSession(sessionId)
        if (existing == null) {
          throw notFound('Session not found', { id: sessionId }, 'session_not_found')
        }

        const payload = asRecord(body) ?? {}
        const onSessionUpdated = (session: Parameters<typeof notifySessionUpdated>[1]) => {
          notifySessionUpdated(sessionId, session)
        }

        if (payload.type === 'message' && payload.data != null) {
          const event: WSEvent = { type: 'message', message: payload.data as ChatMessage }
          applySessionEvent(sessionId, event, {
            broadcast: ev => broadcastSessionEvent(sessionId, ev),
            onSessionUpdated
          })
          return { ok: true }
        }
        if (payload.type === 'message' && payload.message != null && typeof payload.message !== 'string') {
          const event: WSEvent = { type: 'message', message: payload.message as ChatMessage }
          applySessionEvent(sessionId, event, {
            broadcast: ev => broadcastSessionEvent(sessionId, ev),
            onSessionUpdated
          })
          return { ok: true }
        }
        if (payload.type === 'summary' && asRecord(payload.data)?.summary != null) {
          const event: WSEvent = {
            type: 'session_info',
            info: {
              type: 'summary',
              summary: String(asRecord(payload.data)?.summary ?? ''),
              leafUuid: asString(asRecord(payload.data)?.leafUuid)
            } satisfies SessionInfo
          }
          applySessionEvent(sessionId, event, {
            broadcast: ev => broadcastSessionEvent(sessionId, ev),
            onSessionUpdated
          })
          return { ok: true }
        }
        if (payload.type === 'summary' && typeof payload.summary === 'string') {
          const event: WSEvent = {
            type: 'session_info',
            info: {
              type: 'summary',
              summary: payload.summary,
              leafUuid: asString(payload.leafUuid)
            } satisfies SessionInfo
          }
          applySessionEvent(sessionId, event, {
            broadcast: ev => broadcastSessionEvent(sessionId, ev),
            onSessionUpdated
          })
          return { ok: true }
        }
        if (payload.type === 'init' && payload.data != null) {
          const info = payload.data as SessionInitInfo
          applySessionEvent(sessionId, {
            type: 'session_info',
            info: {
              ...info,
              type: 'init'
            } as SessionInfo
          }, {
            broadcast: ev => broadcastSessionEvent(sessionId, ev),
            onSessionUpdated
          })
          return { ok: true }
        }
        if (payload.type === 'interaction_request' && typeof payload.id === 'string' && payload.payload != null) {
          const event: WSEvent = {
            type: 'interaction_request',
            id: payload.id,
            payload: payload.payload as any
          }
          setSessionInteraction(sessionId, { id: payload.id, payload: payload.payload as any })
          applySessionEvent(sessionId, event, {
            broadcast: ev => broadcastSessionEvent(sessionId, ev),
            onSessionUpdated
          })
          return { ok: true }
        }
        if (payload.type === 'interaction_response' && typeof payload.id === 'string' && payload.data != null) {
          const handled = handleInteractionResponse(sessionId, payload.id, payload.data)
          if (!handled) {
            throw conflict(
              'Interaction response is no longer pending',
              { id: payload.id },
              'interaction_not_pending'
            )
          }
          return { ok: true }
        }
        if (payload.type === 'error' && asRecord(payload.data)?.message != null) {
          const message = String(asRecord(payload.data)?.message ?? '')
          const event: WSEvent = { type: 'error', data: payload.data as any, message }
          applySessionEvent(sessionId, event, {
            broadcast: ev => broadcastSessionEvent(sessionId, ev),
            onSessionUpdated
          })
          return { ok: true }
        }
        if (payload.type === 'error' && typeof payload.message === 'string') {
          const event: WSEvent = {
            type: 'error',
            data: {
              message: payload.message,
              fatal: true
            },
            message: payload.message
          }
          applySessionEvent(sessionId, event, {
            broadcast: ev => broadcastSessionEvent(sessionId, ev),
            onSessionUpdated
          })
          return { ok: true }
        }
        if (payload.type === 'exit') {
          const exitCode = Number(asRecord(payload.data)?.exitCode ?? payload.exitCode ?? 0)
          if (exitCode === 0) {
            updateAndNotifySession(sessionId, { status: 'completed' })
          } else {
            const stderr = String(asRecord(payload.data)?.stderr ?? payload.stderr ?? '')
            const latestSession = getDb().getSession(sessionId)
            if (latestSession?.status !== 'failed') {
              const message = stderr !== ''
                ? `Process exited with code ${exitCode}, stderr:\n${stderr}`
                : `Process exited with code ${exitCode}`
              const event: WSEvent = {
                type: 'error',
                data: {
                  message,
                  details: stderr !== '' ? { stderr } : undefined,
                  fatal: true
                },
                message
              }
              applySessionEvent(sessionId, event, {
                broadcast: ev => broadcastSessionEvent(sessionId, ev),
                onSessionUpdated
              })
            }
          }
          return { ok: true }
        }
        if (payload.type === 'stop') {
          const latestSession = getDb().getSession(sessionId)
          if (latestSession?.status !== 'failed') {
            updateAndNotifySession(sessionId, { status: 'completed' })
          }
          return { ok: true }
        }

        throw badRequest('Invalid event', { type: payload.type }, 'invalid_event')
      })
      client.expose('/sessions/:session_id/fork', {
        method: 'POST',
        description: 'Fork one full session into a new session with copied workspace and messages.'
      }, async ({ params: requestParams, body }) => {
        const sessionId = asString(requestParams.session_id)
        const title = asString(asRecord(body)?.title)
        const db = getDb()
        const original = db.getSession(sessionId)
        if (original == null) {
          throw notFound('Original session not found', { id: sessionId }, 'original_session_not_found')
        }

        const newSession = db.createSession(title !== '' ? title : `${original.title} (Fork)`)
        try {
          await provisionSessionWorkspace(newSession.id, { sourceSessionId: original.id })
          db.copyMessages(sessionId, newSession.id)
          if (original.promptType !== undefined || original.promptName !== undefined) {
            db.updateSession(newSession.id, {
              promptType: original.promptType,
              promptName: original.promptName
            })
          }
        } catch (error) {
          await deleteSessionWorkspace(newSession.id, { force: true }).catch(() => undefined)
          db.deleteSession(newSession.id)
          throw error
        }

        notifySessionUpdated(newSession.id, db.getSession(newSession.id) ?? newSession)
        return { session: db.getSession(newSession.id) ?? newSession }
      })
      client.expose('/sessions/:session_id/messages/:message_id/branch', {
        method: 'POST',
        description: 'Fork, recall or edit a branch from one message.'
      }, async ({ params: requestParams, body }) => {
        const payload = asRecord(body) ?? {}
        const action = asString(payload.action)
        if (action !== 'fork' && action !== 'recall' && action !== 'edit') {
          throw badRequest('Invalid message action', { action }, 'invalid_message_action')
        }

        const branchResult = await branchSessionFromMessage({
          sessionId: asString(requestParams.session_id),
          messageId: asString(requestParams.message_id),
          action,
          content: payload.content as string | ChatMessageContent[] | undefined,
          title: asString(payload.title) || undefined
        })

        if (branchResult.replayContent != null) {
          void processUserMessage(branchResult.session.id, branchResult.replayContent).catch((error) => {
            console.error('[sessions] failed to continue branched session:', error)
          })
        }

        return { session: getDb().getSession(branchResult.session.id) ?? branchResult.session }
      })
      client.expose('/sessions/:session_id/queued-messages', {
        method: 'GET',
        description: 'List queued steer/next messages for one session.'
      }, ({ params: requestParams }) => ({
        queuedMessages: listSessionQueuedMessages(asString(requestParams.session_id))
      }))
      client.expose('/sessions/:session_id/queued-messages/add', {
        method: 'POST',
        description: 'Add a queued steer or next message.'
      }, ({ params: requestParams, body }) => {
        const payload = asRecord(body) ?? {}
        const mode = asString(payload.mode) as SessionQueuedMessageMode
        const content = Array.isArray(payload.content) ? payload.content as ChatMessageContent[] : undefined
        if (mode !== 'steer' && mode !== 'next') {
          throw badRequest('Invalid queued message mode', { mode }, 'invalid_queued_message_mode')
        }
        if (content == null || content.length === 0) {
          throw badRequest('Queued message content cannot be empty', undefined, 'empty_queued_message_content')
        }

        const sessionId = asString(requestParams.session_id)
        const queuedMessage = createSessionQueuedMessage(sessionId, mode, content)
        return {
          queuedMessage,
          queuedMessages: listSessionQueuedMessages(sessionId)
        }
      })
      client.expose('/sessions/:session_id/queued-messages/:queue_id/update', {
        method: 'POST',
        description: 'Update one queued message.'
      }, ({ params: requestParams, body }) => {
        const content = Array.isArray(asRecord(body)?.content)
          ? asRecord(body)?.content as ChatMessageContent[]
          : undefined
        if (content == null || content.length === 0) {
          throw badRequest('Queued message content cannot be empty', undefined, 'empty_queued_message_content')
        }
        const updated = updateSessionQueuedMessage(
          asString(requestParams.session_id),
          asString(requestParams.queue_id),
          content
        )
        if (updated == null) {
          throw notFound('Queued message not found', requestParams, 'queued_message_not_found')
        }
        return {
          queuedMessage: updated,
          queuedMessages: listSessionQueuedMessages(asString(requestParams.session_id))
        }
      })
      client.expose('/sessions/:session_id/queued-messages/:queue_id/delete', {
        method: 'POST',
        description: 'Delete one queued message.'
      }, ({ params: requestParams }) => {
        const removed = deleteSessionQueuedMessage(
          asString(requestParams.session_id),
          asString(requestParams.queue_id)
        )
        if (!removed) {
          throw notFound('Queued message not found', requestParams, 'queued_message_not_found')
        }
        return {
          ok: true,
          queuedMessages: listSessionQueuedMessages(asString(requestParams.session_id))
        }
      })
      client.expose('/sessions/:session_id/queued-messages/:queue_id/move', {
        method: 'POST',
        description: 'Move one queued message between steer and next groups.'
      }, ({ params: requestParams, body }) => {
        const mode = asString(asRecord(body)?.mode) as SessionQueuedMessageMode
        if (mode !== 'steer' && mode !== 'next') {
          throw badRequest('Invalid queued message mode', { mode }, 'invalid_queued_message_mode')
        }
        const moved = moveSessionQueuedMessage(asString(requestParams.session_id), asString(requestParams.queue_id), mode)
        if (moved == null) {
          throw notFound('Queued message not found', requestParams, 'queued_message_not_found')
        }
        return {
          queuedMessage: moved,
          queuedMessages: listSessionQueuedMessages(asString(requestParams.session_id))
        }
      })
      client.expose('/sessions/:session_id/queued-messages/reorder', {
        method: 'POST',
        description: 'Reorder queued messages inside one mode.'
      }, ({ params: requestParams, body }) => {
        const payload = asRecord(body) ?? {}
        const mode = asString(payload.mode) as SessionQueuedMessageMode
        const ids = asStringArray(payload.ids)
        if (mode !== 'steer' && mode !== 'next') {
          throw badRequest('Invalid queued message mode', { mode }, 'invalid_queued_message_mode')
        }
        if (ids.length === 0) {
          throw badRequest('Invalid queued message order', { ids }, 'invalid_queued_message_order')
        }
        reorderSessionQueuedMessages(asString(requestParams.session_id), mode, ids)
        return {
          queuedMessages: listSessionQueuedMessages(asString(requestParams.session_id))
        }
      })

      client.expose('/sessions/:session_id/workspace/skill.md', sessionWorkspaceSkill)
      client.expose('/sessions/:session_id/workspace', {
        method: 'GET',
        description: 'Return one session workspace summary.'
      }, async ({ params: requestParams }) => ({
        workspace: await resolveSessionWorkspace(asString(requestParams.session_id))
      }))
      client.expose('/sessions/:session_id/workspace/tree', {
        method: 'GET',
        description: 'List files in one session workspace tree.'
      }, async ({ params: requestParams, queries }) => {
        const workspaceFolder = await resolveSessionWorkspaceFolder(asString(requestParams.session_id))
        return await listWorkspaceTree(asString(queries.path) || undefined, { workspaceFolder })
      })
      client.expose('/sessions/:session_id/workspace/file', {
        method: 'GET',
        description: 'Read one file from a session workspace.'
      }, async ({ params: requestParams, queries }) => {
        const workspaceFolder = await resolveSessionWorkspaceFolder(asString(requestParams.session_id))
        return await readWorkspaceFile(asString(queries.path) || undefined, { workspaceFolder })
      })
      client.expose('/sessions/:session_id/workspace/file/update', {
        method: 'POST',
        description: 'Write one file inside a session workspace.'
      }, async ({ params: requestParams, body }) => {
        const payload = asRecord(body) ?? {}
        const workspaceFolder = await resolveSessionWorkspaceFolder(asString(requestParams.session_id))
        return await updateWorkspaceFile(asString(payload.path) || undefined, payload.content, { workspaceFolder })
      })
      client.expose('/sessions/:session_id/workspace/resource', {
        method: 'GET',
        description: 'Resolve one binary/image resource in a session workspace.'
      }, async ({ params: requestParams, queries }) => {
        const workspaceFolder = await resolveSessionWorkspaceFolder(asString(requestParams.session_id))
        return await readWorkspaceResourceSummary(asString(queries.path) || undefined, { workspaceFolder })
      })
      client.expose('/sessions/:session_id/workspace/create-worktree', {
        method: 'POST',
        description: 'Move one session workspace into a managed worktree and stop the session.'
      }, async ({ params: requestParams }) => {
        const sessionId = asString(requestParams.session_id)
        const workspace = await createSessionManagedWorktree(sessionId)
        killSession(sessionId)
        disposeTerminalSession(sessionId)
        return { workspace }
      })
      client.expose('/sessions/:session_id/workspace/transfer-local', {
        method: 'POST',
        description: 'Transfer one session workspace into a local workspace.'
      }, async ({ params: requestParams }) => ({
        workspace: await transferSessionWorkspaceToLocal(asString(requestParams.session_id))
      }))

      client.expose('/sessions/:session_id/git/skill.md', sessionGitSkill)
      client.expose('/sessions/:session_id/git/state', {
        method: 'GET',
        description: 'Read git state for one session workspace.'
      }, async ({ params: requestParams }) => await getSessionGitState(asString(requestParams.session_id)))
      client.expose('/sessions/:session_id/git/branches', {
        method: 'GET',
        description: 'List git branches for one session workspace.'
      }, async ({ params: requestParams }) => await listSessionGitBranches(asString(requestParams.session_id)))
      client.expose('/sessions/:session_id/git/worktrees', {
        method: 'GET',
        description: 'List git worktrees for one session workspace.'
      }, async ({ params: requestParams }) => await listSessionGitWorktrees(asString(requestParams.session_id)))
      client.expose('/sessions/:session_id/git/checkout', {
        method: 'POST',
        description: 'Checkout one branch in a session workspace.'
      }, async ({ params: requestParams, body }) => {
        const payload = asRecord(body) ?? {}
        const name = asString(payload.name)
        const kind = asString(payload.kind) as GitBranchKind
        if ((kind !== 'local' && kind !== 'remote') || name === '') {
          throw badRequest('Invalid git checkout request', { name, kind }, 'git_checkout_invalid_payload')
        }
        return { repo: await checkoutSessionGitBranch(asString(requestParams.session_id), { kind, name }) }
      })
      client.expose('/sessions/:session_id/git/branch/create', {
        method: 'POST',
        description: 'Create one new git branch in a session workspace.'
      }, async ({ params: requestParams, body }) => {
        const name = asString(asRecord(body)?.name)
        if (name === '') {
          throw badRequest('Branch name is required', { name }, 'git_branch_name_required')
        }
        return { repo: await createSessionGitBranch(asString(requestParams.session_id), name) }
      })
      client.expose('/sessions/:session_id/git/commit', {
        method: 'POST',
        description: 'Commit git changes in one session workspace.'
      }, async ({ params: requestParams, body }) => ({
        repo: await commitSessionGitChanges(asString(requestParams.session_id), (body ?? {}) as GitCommitPayload)
      }))
      client.expose('/sessions/:session_id/git/push', {
        method: 'POST',
        description: 'Push git changes from one session workspace.'
      }, async ({ params: requestParams, body }) => ({
        repo: await pushSessionGitBranch(asString(requestParams.session_id), (body ?? {}) as GitPushPayload)
      }))
      client.expose('/sessions/:session_id/git/sync', {
        method: 'POST',
        description: 'Sync git branch for one session workspace.'
      }, async ({ params: requestParams }) => ({
        repo: await syncSessionGitBranch(asString(requestParams.session_id))
      }))

      client.expose('/workspace/tree', {
        method: 'GET',
        description: 'List files in the current workspace tree.'
      }, async ({ queries }) => await listWorkspaceTree(asString(queries.path) || undefined))
      client.expose('/workspace/file', {
        method: 'GET',
        description: 'Read one file from the current workspace.'
      }, async ({ queries }) => await readWorkspaceFile(asString(queries.path) || undefined))
      client.expose('/workspace/file/update', {
        method: 'POST',
        description: 'Write one file in the current workspace.'
      }, async ({ body }) => {
        const payload = asRecord(body) ?? {}
        return await updateWorkspaceFile(asString(payload.path) || undefined, payload.content)
      })
      client.expose('/workspace/resource', {
        method: 'GET',
        description: 'Resolve one binary/image resource from the current workspace.'
      }, async ({ queries }) => await readWorkspaceResourceSummary(asString(queries.path) || undefined))
      client.expose('/workspace/git/state', {
        method: 'GET',
        description: 'Read git state for the current workspace.'
      }, async () => await getWorkspaceGitState())
      client.expose('/workspace/git/branches', {
        method: 'GET',
        description: 'List git branches for the current workspace.'
      }, async () => await listWorkspaceGitBranches())
      client.expose('/workspace/git/worktrees', {
        method: 'GET',
        description: 'List git worktrees for the current workspace.'
      }, async () => await listWorkspaceGitWorktrees())

      client.expose('/worktree-environments', {
        method: 'GET',
        description: 'List saved worktree environments.'
      }, async () => await listWorktreeEnvironments())
      client.expose('/worktree-environments/:id', {
        method: 'GET',
        description: 'Read one saved worktree environment.'
      }, async ({ params: requestParams, queries }) => ({
        environment: await getWorktreeEnvironment(
          assertEnvironmentId(asString(requestParams.id)),
          undefined,
          getEnvironmentSource(queries.source)
        )
      }))
      client.expose('/worktree-environments/:id/save', {
        method: 'POST',
        description: 'Save one worktree environment.'
      }, async ({ params: requestParams, queries, body }) => ({
        environment: await saveWorktreeEnvironment(
          assertEnvironmentId(asString(requestParams.id)),
          (body ?? {}) as WorktreeEnvironmentSavePayload,
          undefined,
          getEnvironmentSource(queries.source)
        )
      }))
      client.expose('/worktree-environments/:id/delete', {
        method: 'POST',
        description: 'Delete one worktree environment.'
      }, async ({ params: requestParams, queries }) => ({
        ok: true,
        removed: await deleteWorktreeEnvironment(
          assertEnvironmentId(asString(requestParams.id)),
          undefined,
          getEnvironmentSource(queries.source)
        )
      }))

      client.expose('/automation/rules', {
        method: 'GET',
        description: 'List automation rules.'
      }, () => {
        ensureAutomationScheduler()
        return { rules: getDb().listAutomationRuleDetails() }
      })
      client.expose('/automation/rules/create', {
        method: 'POST',
        description: 'Create a new automation rule.'
      }, async ({ body }) => {
        ensureAutomationScheduler()
        const payload = asRecord(body) ?? {}
        const name = asString(payload.name)
        const description = normalizeOptionalString(payload.description)
        const enabled = payload.enabled !== false
        const immediateRun = payload.immediateRun === true
        const triggers = Array.isArray(payload.triggers) ? payload.triggers : []
        const tasks = Array.isArray(payload.tasks) ? payload.tasks : []
        if (name === '' || triggers.length === 0 || tasks.length === 0) {
          throw invalidPayload()
        }
        const normalizedTriggers = triggers.map(trigger => normalizeAutomationTrigger((asRecord(trigger) ?? {}) as Partial<AutomationTrigger>))
        const normalizedTasks = tasks.map((task, index) => normalizeAutomationTask((asRecord(task) ?? {}) as Partial<AutomationTask>, index))
        const primaryTrigger = normalizedTriggers[0]
        const primaryTask = normalizedTasks[0]
        const rule: AutomationRule = {
          id: randomUUID(),
          name,
          description,
          type: primaryTrigger?.type ?? 'interval',
          intervalMs: primaryTrigger?.intervalMs ?? null,
          webhookKey: primaryTrigger?.webhookKey ?? null,
          cronExpression: primaryTrigger?.cronExpression ?? null,
          prompt: primaryTask?.prompt ?? '',
          enabled,
          createdAt: Date.now(),
          lastRunAt: null,
          lastSessionId: null
        }
        const db = getDb()
        db.createAutomationRule(rule)
        db.replaceAutomationTriggers(rule.id, normalizedTriggers)
        db.replaceAutomationTasks(rule.id, normalizedTasks)
        if (enabled) {
          scheduleAutomationRule(rule.id)
        }
        if (immediateRun) {
          await runAutomationRule(rule.id, { ignoreEnabled: true })
        }
        return { rule: db.getAutomationRuleDetail(rule.id) }
      })
      client.expose('/automation/rules/:id/update', {
        method: 'POST',
        description: 'Update an existing automation rule.'
      }, async ({ params: requestParams, body }) => {
        ensureAutomationScheduler()
        const ruleId = asString(requestParams.id)
        const db = getDb()
        const existing = db.getAutomationRule(ruleId)
        if (existing == null) {
          throw notFound('Rule not found', { id: ruleId }, 'rule_not_found')
        }
        const payload = asRecord(body) ?? {}
        const updates: Partial<AutomationRule> = {}
        const immediateRun = payload.immediateRun === true
        if (payload.name !== undefined) updates.name = asString(payload.name)
        if (payload.description !== undefined) updates.description = normalizeOptionalString(payload.description)
        if (payload.enabled !== undefined) updates.enabled = asBoolean(payload.enabled)
        if (updates.name !== undefined && updates.name === '') {
          throw invalidPayload()
        }
        if (Array.isArray(payload.triggers)) {
          if (payload.triggers.length === 0) throw invalidPayload()
          const normalizedTriggers = payload.triggers.map((trigger) =>
            normalizeAutomationTrigger((asRecord(trigger) ?? {}) as Partial<AutomationTrigger>)
          )
          const primaryTrigger = normalizedTriggers[0]
          updates.type = primaryTrigger?.type ?? existing.type
          updates.intervalMs = primaryTrigger?.intervalMs ?? null
          updates.webhookKey = primaryTrigger?.webhookKey ?? null
          updates.cronExpression = primaryTrigger?.cronExpression ?? null
          removeAutomationRuleSchedule(ruleId)
          db.replaceAutomationTriggers(ruleId, normalizedTriggers)
        }
        if (Array.isArray(payload.tasks)) {
          if (payload.tasks.length === 0) throw invalidPayload()
          const normalizedTasks = payload.tasks.map((task, index) =>
            normalizeAutomationTask((asRecord(task) ?? {}) as Partial<AutomationTask>, index)
          )
          const primaryTask = normalizedTasks[0]
          updates.prompt = primaryTask?.prompt ?? existing.prompt
          db.replaceAutomationTasks(ruleId, normalizedTasks)
        }
        db.updateAutomationRule(ruleId, updates)
        const updated = db.getAutomationRule(ruleId)
        if (updated?.enabled) {
          scheduleAutomationRule(ruleId)
        }
        if (immediateRun) {
          await runAutomationRule(ruleId, { ignoreEnabled: true })
        }
        return { rule: db.getAutomationRuleDetail(ruleId) }
      })
      client.expose('/automation/rules/:id/delete', {
        method: 'POST',
        description: 'Delete an automation rule.'
      }, ({ params: requestParams }) => {
        ensureAutomationScheduler()
        const ruleId = asString(requestParams.id)
        const removed = getDb().deleteAutomationRule(ruleId)
        if (removed) {
          removeAutomationRuleSchedule(ruleId)
        }
        return { ok: true, removed }
      })
      client.expose('/automation/rules/:id/run', {
        method: 'POST',
        description: 'Run one automation rule immediately.'
      }, async ({ params: requestParams }) => ({
        result: await runAutomationRule(asString(requestParams.id))
      }))
      client.expose('/automation/rules/:id/runs', {
        method: 'GET',
        description: 'List historical runs for one automation rule.'
      }, ({ params: requestParams }) => ({
        runs: getDb().listAutomationRuns(asString(requestParams.id))
      }))

      client.expose('/benchmark/categories', {
        method: 'GET',
        description: 'List benchmark categories.'
      }, async () => await listBenchmarkCategorySummaries())
      client.expose('/benchmark/cases', {
        method: 'GET',
        description: 'List benchmark cases.'
      }, async ({ queries }) => await listBenchmarkCaseSummaries({ category: asString(queries.category) || undefined }))
      client.expose('/benchmark/cases/:category/:title', {
        method: 'GET',
        description: 'Inspect one benchmark case.'
      }, async ({ params: requestParams }) => await getBenchmarkCaseDetail({
        category: asString(requestParams.category),
        title: asString(requestParams.title)
      }))
      client.expose('/benchmark/results', {
        method: 'GET',
        description: 'List benchmark results.'
      }, async ({ queries }) => await listBenchmarkResultSummaries({
        category: asString(queries.category) || undefined,
        title: asString(queries.title) || undefined
      }))
      client.expose('/benchmark/results/:category/:title', {
        method: 'GET',
        description: 'Read one benchmark result.'
      }, async ({ params: requestParams }) => await getBenchmarkResultDetail({
        category: asString(requestParams.category),
        title: asString(requestParams.title)
      }))
      client.expose('/benchmark/runs/:run_id', {
        method: 'GET',
        description: 'Read one live benchmark run.'
      }, ({ params: requestParams }) => getBenchmarkRunDetail(asString(requestParams.run_id)))
      client.expose('/benchmark/run', {
        method: 'POST',
        description: 'Start a benchmark run.'
      }, async ({ body }) => await startBenchmarkRun((asRecord(body) ?? {}) as Parameters<typeof startBenchmarkRun>[0]))

      client.expose('/config', {
        method: 'GET',
        description: 'Load full config sources and metadata.'
      }, async () => await loadConfigResponse())
      client.expose('/config/schema', {
        method: 'GET',
        description: 'Load config schema bundles.'
      }, async () => await loadConfigSchemaResponse())
      client.expose('/config/schema/generate', {
        method: 'POST',
        description: 'Generate the workspace config schema file.'
      }, async () => await generateWorkspaceConfigSchema())
      client.expose('/config/update', {
        method: 'POST',
        description: 'Update one config section and reload affected runtimes.'
      }, async ({ body }) => {
        const payload = asRecord(body) ?? {}
        const source = asString(payload.source)
        const section = asString(payload.section)
        if (source !== 'project' && source !== 'user') {
          throw badRequest('Invalid source', { source }, 'invalid_source')
        }
        if (section === '') {
          throw badRequest('Invalid section', { section }, 'invalid_section')
        }
        return await updateConfigSectionAndReload({
          source,
          section,
          value: payload.value
        })
      })

      client.expose('/catalog/specs', {
        method: 'GET',
        description: 'List AI specs.'
      }, async () => {
        const loader = loadDefinitionLoader()
        const workspaceRoot = getWorkspaceFolder()
        const specs = await loader.loadDefaultSpecs()
        return { specs: specs.map(spec => presentSpec(spec, workspaceRoot)) }
      })
      client.expose('/catalog/specs/detail', {
        method: 'GET',
        description: 'Read one AI spec by path.'
      }, async ({ queries }) => {
        const targetPath = asString(queries.path)
        if (targetPath === '') {
          throw badRequest('Missing path', undefined, 'missing_path')
        }
        const loader = loadDefinitionLoader()
        const workspaceRoot = getWorkspaceFolder()
        const specs = await loader.loadDefaultSpecs()
        const spec = specs.find(item => matchesDefinitionPath(item, targetPath, workspaceRoot))
        if (spec == null) {
          throw notFound('Spec not found', { path: targetPath }, 'spec_not_found')
        }
        return { spec: presentSpecDetail(spec, workspaceRoot) }
      })
      client.expose('/catalog/entities', {
        method: 'GET',
        description: 'List AI entities.'
      }, async () => {
        const loader = loadDefinitionLoader()
        const workspaceRoot = getWorkspaceFolder()
        const entities = await loader.loadDefaultEntities()
        return { entities: entities.map(entity => presentEntity(entity, workspaceRoot)) }
      })
      client.expose('/catalog/entities/detail', {
        method: 'GET',
        description: 'Read one AI entity by path.'
      }, async ({ queries }) => {
        const targetPath = asString(queries.path)
        if (targetPath === '') {
          throw badRequest('Missing path', undefined, 'missing_path')
        }
        const loader = loadDefinitionLoader()
        const workspaceRoot = getWorkspaceFolder()
        const entities = await loader.loadDefaultEntities()
        const entity = entities.find(item => matchesDefinitionPath(item, targetPath, workspaceRoot))
        if (entity == null) {
          throw notFound('Entity not found', { path: targetPath }, 'entity_not_found')
        }
        return { entity: presentEntityDetail(entity, workspaceRoot) }
      })
      client.expose('/catalog/rules', {
        method: 'GET',
        description: 'List AI rules.'
      }, async () => {
        const loader = loadDefinitionLoader()
        const workspaceRoot = getWorkspaceFolder()
        const rules = await loader.loadDefaultRules()
        return { rules: rules.map(rule => presentRule(rule, workspaceRoot)) }
      })
      client.expose('/catalog/rules/detail', {
        method: 'GET',
        description: 'Read one AI rule by path.'
      }, async ({ queries }) => {
        const targetPath = asString(queries.path)
        if (targetPath === '') {
          throw badRequest('Missing path', undefined, 'missing_path')
        }
        const loader = loadDefinitionLoader()
        const workspaceRoot = getWorkspaceFolder()
        const rules = await loader.loadDefaultRules()
        const rule = rules.find(item => matchesDefinitionPath(item, targetPath, workspaceRoot))
        if (rule == null) {
          throw notFound('Rule not found', { path: targetPath }, 'rule_not_found')
        }
        return { rule: presentRuleDetail(rule, workspaceRoot) }
      })
      client.expose('/catalog/workspaces', {
        method: 'GET',
        description: 'List configured workspaces.'
      }, async () => {
        const loader = loadDefinitionLoader()
        const workspaces = await loader.loadWorkspaces()
        return { workspaces: workspaces.map(presentWorkspace) }
      })

      client.expose('/interactions/ask', {
        method: 'POST',
        description: 'Request an ask-user-question interaction and await the response.'
      }, async ({ body }) => {
        const parsed = AskUserQuestionParamsSchema.safeParse(body)
        if (!parsed.success) {
          throw badRequest('Invalid parameters', parsed.error.errors, 'invalid_parameters')
        }
        try {
          return { result: await requestInteraction(parsed.data) }
        } catch (error) {
          if (error instanceof Error && error.message.includes('not active')) {
            throw notFound(error.message, undefined, 'interaction_not_active')
          }
          throw requestTimeout(error instanceof Error ? error.message : String(error), undefined, 'interaction_timeout')
        }
      })
      client.expose('/interactions/permission-check', {
        method: 'POST',
        description: 'Evaluate one session permission decision.'
      }, async ({ body }) => {
        const payload = asRecord(body) ?? {}
        const sessionId = asString(payload.sessionId)
        if (sessionId === '') {
          throw badRequest('Invalid parameters', undefined, 'invalid_parameters')
        }
        const subject = resolvePermissionSubjectFromInput({
          toolName: asString(payload.toolName) || undefined,
          mcpServer: asString(payload.mcpServer) || undefined
        })
        const result = await resolvePermissionDecision({ sessionId, subject })
        return {
          result: result.result,
          source: result.source,
          subject
        }
      })
    },
    createClient: ({ serverUrl, client, auth }) => createMdpClient({
      serverUrl,
      client,
      ...(auth == null ? {} : { auth }),
      reconnect: {
        enabled: true
      }
    }),
    onConnectionError: (connection, error) => {
      logger.warn({ connectionKey: connection.key, error: error.message }, '[mdp] server runtime connect failed')
    }
  })
}

const createChannelClientHandles = async (params: {
  workspaceFolder: string
  mergedConfig: Config | undefined
}) => {
  const mdp = resolveMdpConfig(params.mergedConfig)
  return await connectRuntimeClients<MdpClient>({
    mdp,
    buildClientInfo: (connection) => ({
      id: buildRuntimeClientId([
        'channels',
        connection.key,
        params.workspaceFolder,
        String(process.pid)
      ]),
      name: 'Vibe Forge Channels',
      description: 'Channel runtime endpoints for Vibe Forge',
      metadata: {
        component: 'channels',
        connectionKey: connection.key,
        workspaceFolder: params.workspaceFolder
      }
    }),
    configureClient: (client) => {
      client.expose('/skill.md', {
        description: 'Available Vibe Forge channel runtimes.'
      }, () => buildChannelsSkillContent(resolveChannelPathEntries()))

      const channelEntries = resolveChannelPathEntries()
      for (const type of Array.from(new Set(channelEntries.map(entry => entry.type)))) {
        client.expose(`/${type}/skill.md`, {
          description: loadChannelModule(type).definition.description ?? `${type} channel runtime`
        }, () => buildChannelTypeSkillContent(type, resolveChannelPathEntries()))
      }

      for (const entry of channelEntries) {
        const basePath = `/${entry.type}/${entry.instanceKey}`
        client.expose(`${basePath}/skill.md`, {
          description: entry.description ?? `${entry.label} channel runtime`
        }, () => buildChannelSkillContent(entry))
        client.expose(`${basePath}/state`, {
          method: 'GET',
          description: `Return runtime state for channel ${entry.key}.`
        }, () => resolveChannelPathEntry(entry.type, entry.instanceKey) ?? entry)
        client.expose(`${basePath}/bindings`, {
          method: 'GET',
          description: `Return session bindings and preferences for channel ${entry.key}.`
        }, () => resolveChannelBindings(entry))
        client.expose(`${basePath}/contexts`, {
          method: 'GET',
          description: `Return normalized channel contexts for ${entry.key}. Optional query: sessionType, channelId.`
        }, ({ queries }) => resolveChannelContexts(entry, {
          ...(asString(queries.sessionType) !== '' ? { sessionType: asString(queries.sessionType) } : {}),
          ...(asString(queries.channelId) !== '' ? { channelId: asString(queries.channelId) } : {})
        }))
        client.expose(`${basePath}/search-sessions`, {
          method: 'GET',
          description: `Search bindable sessions for channel ${entry.key}. Optional query: query, limit, offset, sessionType, channelId.`
        }, ({ queries }) => searchChannelSessions({
          entry,
          ...(asString(queries.query) !== '' ? { query: asString(queries.query) } : {}),
          ...(asOptionalNumber(queries.limit) != null ? { limit: asOptionalNumber(queries.limit) } : {}),
          ...(asOptionalNumber(queries.offset) != null ? { offset: asOptionalNumber(queries.offset) } : {}),
          ...(asString(queries.sessionType) !== '' && asString(queries.channelId) !== ''
            ? {
              target: {
                sessionType: asString(queries.sessionType),
                channelId: asString(queries.channelId)
              }
            }
            : {})
        }))
        client.expose(`${basePath}/commands`, {
          method: 'GET',
          description: `Return the structured command catalog for channel ${entry.key}.`
        }, () => resolveChannelCommandCatalog(resolveChannelRuntimeState(entry)?.config))
        client.expose(`${basePath}/schemas`, {
          method: 'GET',
          description: `Return request body schema summaries for channel ${entry.key}.`
        }, () => resolveChannelSchemas(entry))
        client.expose(`${basePath}/bind-session`, {
          method: 'POST',
          description: `Bind a concrete channel context in ${entry.key} to an existing session.`
        }, ({ body }) => {
          const parsed = channelBindSessionSchema.safeParse(body)
          if (!parsed.success) {
            throw new Error(parsed.error.message)
          }

          return bindChannelSessionTarget({
            entry,
            target: parsed.data.target,
            sessionId: parsed.data.sessionId
          })
        })
        client.expose(`${basePath}/unbind-session`, {
          method: 'POST',
          description: `Remove the session binding for a concrete channel context in ${entry.key}.`
        }, ({ body }) => {
          const parsed = channelTargetRequestSchema.safeParse(body)
          if (!parsed.success) {
            throw new Error(parsed.error.message)
          }

          return unbindChannelSessionTarget({
            entry,
            target: parsed.data.target
          })
        })
        client.expose(`${basePath}/reset-session`, {
          method: 'POST',
          description: `Archive and unbind the current session tree for a concrete channel context in ${entry.key}.`
        }, ({ body }) => {
          const parsed = channelTargetRequestSchema.safeParse(body)
          if (!parsed.success) {
            throw new Error(parsed.error.message)
          }

          return resetChannelSessionTarget({
            entry,
            target: parsed.data.target
          })
        })
        client.expose(`${basePath}/stop-session`, {
          method: 'POST',
          description: `Stop the bound session for a concrete channel context in ${entry.key}.`
        }, ({ body }) => {
          const parsed = channelTargetRequestSchema.safeParse(body)
          if (!parsed.success) {
            throw new Error(parsed.error.message)
          }

          return stopChannelSessionTarget({
            entry,
            target: parsed.data.target
          })
        })
        client.expose(`${basePath}/restart-session`, {
          method: 'POST',
          description: `Restart the bound session for a concrete channel context in ${entry.key}.`
        }, async ({ body }) => {
          const parsed = channelTargetRequestSchema.safeParse(body)
          if (!parsed.success) {
            throw new Error(parsed.error.message)
          }

          return await restartChannelSessionTarget({
            entry,
            target: parsed.data.target
          })
        })
        client.expose(`${basePath}/preferences`, {
          method: 'POST',
          description: `Set or clear channel-scoped adapter, permission and effort preferences for ${entry.key}.`
        }, ({ body }) => {
          const parsed = channelPreferencePatchSchema.safeParse(body)
          if (!parsed.success) {
            throw new Error(parsed.error.message)
          }

          return updateChannelPreferenceTarget({
            entry,
            target: parsed.data.target,
            updates: {
              ...(Object.prototype.hasOwnProperty.call(parsed.data, 'adapter') ? { adapter: parsed.data.adapter } : {}),
              ...(Object.prototype.hasOwnProperty.call(parsed.data, 'permissionMode')
                ? { permissionMode: parsed.data.permissionMode }
                : {}),
              ...(Object.prototype.hasOwnProperty.call(parsed.data, 'effort') ? { effort: parsed.data.effort } : {})
            }
          })
        })
        client.expose(`${basePath}/run-command`, {
          method: 'POST',
          description: `Execute a channel command in a synthetic context for ${entry.key}.`
        }, async ({ body }) => await executeChannelCommand({
          entry,
          config: resolveChannelRuntimeState(entry)?.config,
          input: body
        }))

        if (entry.capabilities.sendMessage) {
          client.expose(`${basePath}/send-message`, {
            method: 'POST',
            description: `Send a ${entry.type} message using the configured channel schema.`
          }, ({ body }) => {
            const state = requireConnectedChannelState(entry)
            const mod = loadChannelModule(entry.type)
            const parsed = mod.definition.messageSchema.safeParse(body)
            if (!parsed.success) {
              throw new Error(parsed.error.message)
            }
            return state.connection.sendMessage(parsed.data)
          })
        }

        if (entry.capabilities.updateMessage) {
          client.expose(`${basePath}/update-message`, {
            method: 'POST',
            description: `Update a previously sent ${entry.type} message.`
          }, ({ body }) => {
            const payload = asRecord(body)
            const messageId = asString(payload?.messageId)
            if (messageId === '') {
              throw new Error('messageId is required')
            }

            const state = requireConnectedChannelState(entry)
            const mod = loadChannelModule(entry.type)
            const parsed = mod.definition.messageSchema.safeParse(payload?.message)
            if (!parsed.success) {
              throw new Error(parsed.error.message)
            }
            return state.connection.updateMessage?.(messageId, parsed.data)
          })
        }

        if (entry.capabilities.sendFileMessage) {
          client.expose(`${basePath}/send-file`, {
            method: 'POST',
            description: `Send a file message through channel ${entry.key}.`
          }, ({ body }) => {
            const state = requireConnectedChannelState(entry)
            return state.connection.sendFileMessage?.(parseChannelFileMessage(body))
          })
        }

        if (entry.capabilities.pushFollowUps) {
          client.expose(`${basePath}/push-follow-ups`, {
            method: 'POST',
            description: `Push follow-up messages for channel ${entry.key}.`
          }, ({ body }) => {
            const state = requireConnectedChannelState(entry)
            const input = parseChannelFollowUps(body)
            return state.connection.pushFollowUps?.(input)
          })
        }
      }
    },
    createClient: ({ serverUrl, client, auth }) => createMdpClient({
      serverUrl,
      client,
      ...(auth == null ? {} : { auth }),
      reconnect: {
        enabled: true
      }
    }),
    onConnectionError: (connection, error) => {
      logger.warn({ connectionKey: connection.key, error: error.message }, '[mdp] channel runtime connect failed')
    }
  })
}

export const startServerMdpRuntime = async (params: {
  workspaceFolder: string
  mergedConfig: Config | undefined
}): Promise<ServerMdpRuntimeHandle> => {
  if (activeRuntime != null) {
    await stopServerMdpRuntime()
  }

  const handles: RuntimeClientHandle<MdpClient>[] = [
    ...await createServerClientHandles({
      workspaceFolder: params.workspaceFolder,
      mergedConfig: params.mergedConfig
    }),
    ...await createChannelClientHandles({
      workspaceFolder: params.workspaceFolder,
      mergedConfig: params.mergedConfig
    })
  ]

  const runtime: ServerMdpRuntimeHandle = {
    async stop() {
      await disconnectRuntimeClients(handles)
      if (activeRuntime === runtime) {
        activeRuntime = null
      }
    }
  }

  activeRuntime = runtime
  return runtime
}
