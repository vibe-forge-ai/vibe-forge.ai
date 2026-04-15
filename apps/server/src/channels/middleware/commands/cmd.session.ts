import type { EffortLevel, Session, SessionPermissionMode, SessionWorkspace } from '@vibe-forge/core'

import type { ChannelContext } from '../@types'
import { defineMessages } from '../i18n'
import type { CommandArgumentChoice } from './command-system'
import { command, requiredArg, restArg, variadicArg } from './command-system'

defineMessages('zh', {
  'cmd.session.description': '查看当前会话状态',
  'cmd.session.search.description': '搜索或列出系统内的会话，支持分页，方便重新绑定到当前频道',
  'cmd.session.bind.description': '将当前频道绑定到指定会话',
  'cmd.session.unbind.description': '解绑当前频道与会话，但保留会话本身',
  'cmd.reset.description': '归档并解绑当前会话',
  'cmd.stop.description': '停止当前运行中的会话',
  'cmd.permissionMode.description': '设置当前会话权限模式，或在无会话时设置下一次会话的权限模式',
  'cmd.effort.description': '设置当前会话 effort，或在无会话时设置下一次会话的 effort',
  'cmd.get.description': '查看当前会话的模型、适配器、权限模式或 effort',
  'cmd.set.description': '修改当前会话的模型，或在无会话时设置下一次会话的适配器',
  'choice.session.getField.model.title': '模型',
  'choice.session.getField.model.description': '读取当前会话使用的模型名称。',
  'choice.session.getField.adapter.title': '适配器',
  'choice.session.getField.adapter.description': '读取当前会话绑定的适配器。',
  'choice.session.getField.permissionMode.title': '权限模式',
  'choice.session.getField.permissionMode.description': '读取当前会话的权限策略。',
  'choice.session.getField.effort.title': 'Effort',
  'choice.session.getField.effort.description': '读取当前会话的显式 effort 设置。',
  'choice.session.setField.model.title': '模型',
  'choice.session.setField.model.description': '修改当前会话的模型并立即重启。',
  'choice.session.setField.adapter.title': '适配器',
  'choice.session.setField.adapter.description': '在当前频道无会话时，设置下一次创建会话使用的适配器。',
  'choice.session.effort.default.title': '默认',
  'choice.session.effort.default.description': '清除显式 effort，回退到配置默认值。',
  'choice.session.effort.low.title': '低',
  'choice.session.effort.low.description': '使用较低的思考强度。',
  'choice.session.effort.medium.title': '中',
  'choice.session.effort.medium.description': '使用中等思考强度。',
  'choice.session.effort.high.title': '高',
  'choice.session.effort.high.description': '使用较高思考强度。',
  'choice.session.effort.max.title': '最高',
  'choice.session.effort.max.description': '使用最高思考强度。',
  'choice.session.permissionMode.default.title': '默认',
  'choice.session.permissionMode.default.description': '使用适配器默认的权限行为。',
  'choice.session.permissionMode.acceptEdits.title': '接受编辑',
  'choice.session.permissionMode.acceptEdits.description': '自动接受编辑类操作。',
  'choice.session.permissionMode.plan.title': '规划',
  'choice.session.permissionMode.plan.description': '先规划，再等待进一步执行确认。',
  'choice.session.permissionMode.dontAsk.title': '不询问',
  'choice.session.permissionMode.dontAsk.description': '尽量直接执行，不额外询问。',
  'choice.session.permissionMode.bypassPermissions.title': '绕过权限',
  'choice.session.permissionMode.bypassPermissions.description': '跳过大部分权限检查，风险最高。',
  'session.noSession': '当前频道未绑定会话。',
  'session.notFound': ({ id }) => `当前频道已绑定会话 ${id}，但未找到对应会话记录。`,
  'session.title': ({ title }) => `当前会话：${title}`,
  'session.status': ({ status }) => `状态：${status}`,
  'session.model': ({ model }) => `模型：${model}`,
  'session.adapter': ({ adapter }) => `适配器：${adapter}`,
  'session.messageCount': ({ count }) => `上下文消息数：${count}`,
  'session.permissionMode': ({ mode }) => `权限模式：${mode}`,
  'session.effort': ({ effort }) => `Effort：${effort}`,
  'session.starred': ({ starred }) => `星标：${starred}`,
  'session.archived': ({ archived }) => `归档：${archived}`,
  'session.tags': ({ tags }) => `标签：${tags}`,
  'session.workspace.path': ({ path }) => `工作区：${path}`,
  'session.workspace.mode': ({ mode }) => `工作区模式：${mode}`,
  'session.workspace.cleanup': ({ cleanup }) => `清理策略：${cleanup}`,
  'session.workspace.baseRef': ({ baseRef }) => `基线引用：${baseRef}`,
  'session.workspace.kind.managedWorktree': '托管 worktree',
  'session.workspace.kind.sharedWorkspace': '共享工作区',
  'session.workspace.kind.externalWorkspace': '外部工作区',
  'session.workspace.cleanup.deleteOnSessionDelete': '删除会话时一并删除',
  'session.workspace.cleanup.retain': '删除会话时保留',
  'session.search.empty': '当前没有可列出的会话。',
  'session.search.noResults': ({ query }) => `未找到匹配“${query}”的会话。`,
  'session.search.listHeader': ({ count }) => `最近会话列表（共 ${count} 个）：`,
  'session.search.header': ({ count, query }) => `找到 ${count} 个匹配会话（关键词：${query}）：`,
  'session.search.page': ({ current, total }) => `第 ${current}/${total} 页`,
  'session.search.binding.current': '当前频道',
  'session.search.binding.unbound': '未绑定',
  'session.search.binding.other': ({ channelType, sessionType, channelId }) =>
    `已绑定 ${channelType}/${sessionType}/${channelId}`,
  'session.search.item': ({ index, id, title, status, count, model, binding }) =>
    `${index}. ${id} | ${title} | ${status} | 消息 ${count} | ${model} | ${binding}`,
  'bind.notFound': ({ id }) => `未找到会话 ${id}。`,
  'bind.alreadyBound': ({ id, title }) => `当前频道已绑定到会话 ${id}（${title}），已刷新绑定信息。`,
  'bind.success': ({ id, title }) => `已将当前频道绑定到会话 ${id}（${title}）。`,
  'bind.replaced': ({ previousId }) => `当前频道原先绑定的会话 ${previousId} 已解除绑定。`,
  'bind.transferred': ({ channelType, sessionType, channelId }) =>
    `目标会话原先绑定于 ${channelType}/${sessionType}/${channelId}，已转移到当前频道。`,
  'bind.followUp': '之后在当前频道发送消息会继续该会话。',
  'unbind.noSession': '当前频道没有已绑定会话。',
  'unbind.success': ({ id }) => `已解除当前频道与会话 ${id} 的绑定，会话内容已保留。`,
  'reset.success': '已归档并解绑当前会话，可以继续对话创建新会话。',
  'stop.noSession': '当前频道没有可停止的会话。',
  'stop.notRunning': ({ status }) => `当前会话状态为 ${status}，无需停止。`,
  'stop.success': '已停止当前会话。',
  'set.noSession': '当前频道没有已绑定会话，无法修改会话设置。',
  'set.permissionMode.success': ({ mode }) => `已将权限模式设置为 ${mode}。`,
  'set.permissionMode.pending.success': ({ mode }) =>
    `已将下次会话的权限模式设置为 ${mode}。请发送下一条消息创建新会话。`,
  'set.effort.success': ({ effort }) => `已将 effort 设置为 ${effort}。`,
  'set.effort.pending.success': ({ effort }) => `已将下次会话的 effort 设置为 ${effort}。请发送下一条消息创建新会话。`,
  'set.model.success': ({ model }) => `已设置模型为 ${model}，并重启当前会话。`,
  'set.adapter.pending.success': ({ adapter }) => `已将下次会话的适配器设置为 ${adapter}。请发送下一条消息创建新会话。`,
  'set.adapter.requiresReset': '当前频道已有会话，无法切换适配器。请先执行 /reset 重置会话，再设置适配器。'
})

defineMessages('en', {
  'cmd.session.description': 'Show current session status',
  'cmd.session.search.description':
    'Search or list internal sessions with pagination so they can be rebound into this channel',
  'cmd.session.bind.description': 'Bind this channel to an existing session',
  'cmd.session.unbind.description': 'Unbind this channel from its session without archiving the session',
  'cmd.reset.description': 'Archive and unbind current session',
  'cmd.stop.description': 'Stop the current running session',
  'cmd.permissionMode.description':
    'Set the current session permission mode, or set the next-session permission mode when no session is bound',
  'cmd.effort.description': 'Set the current session effort, or set the next-session effort when no session is bound',
  'cmd.get.description': 'View current session model, adapter, permission mode, or effort',
  'cmd.set.description':
    'Set the current session model, or set the adapter for the next session when no session is bound',
  'choice.session.getField.model.title': 'Model',
  'choice.session.getField.model.description': 'Read the model currently used by the session.',
  'choice.session.getField.adapter.title': 'Adapter',
  'choice.session.getField.adapter.description': 'Read the adapter currently bound to the session.',
  'choice.session.getField.permissionMode.title': 'Permission mode',
  'choice.session.getField.permissionMode.description': 'Read the current session permission strategy.',
  'choice.session.getField.effort.title': 'Effort',
  'choice.session.getField.effort.description': 'Read the current explicit effort setting.',
  'choice.session.setField.model.title': 'Model',
  'choice.session.setField.model.description': 'Change the session model and restart immediately.',
  'choice.session.setField.adapter.title': 'Adapter',
  'choice.session.setField.adapter.description':
    'When no session is bound in this channel, set the adapter used for the next session.',
  'choice.session.effort.default.title': 'Default',
  'choice.session.effort.default.description': 'Clear the explicit effort and fall back to config defaults.',
  'choice.session.effort.low.title': 'Low',
  'choice.session.effort.low.description': 'Use a lower reasoning effort.',
  'choice.session.effort.medium.title': 'Medium',
  'choice.session.effort.medium.description': 'Use a medium reasoning effort.',
  'choice.session.effort.high.title': 'High',
  'choice.session.effort.high.description': 'Use a higher reasoning effort.',
  'choice.session.effort.max.title': 'Max',
  'choice.session.effort.max.description': 'Use the highest reasoning effort.',
  'choice.session.permissionMode.default.title': 'Default',
  'choice.session.permissionMode.default.description': 'Use the adapter default permission behavior.',
  'choice.session.permissionMode.acceptEdits.title': 'Accept edits',
  'choice.session.permissionMode.acceptEdits.description': 'Automatically accept edit-like operations.',
  'choice.session.permissionMode.plan.title': 'Plan',
  'choice.session.permissionMode.plan.description': 'Plan first, then wait for a later execution step.',
  'choice.session.permissionMode.dontAsk.title': 'Do not ask',
  'choice.session.permissionMode.dontAsk.description': 'Execute directly whenever possible without asking.',
  'choice.session.permissionMode.bypassPermissions.title': 'Bypass permissions',
  'choice.session.permissionMode.bypassPermissions.description': 'Skip most permission checks. Highest risk.',
  'session.noSession': 'No session is bound to this channel.',
  'session.notFound': ({ id }) => `Session ${id} is bound but no record found.`,
  'session.title': ({ title }) => `Session: ${title}`,
  'session.status': ({ status }) => `Status: ${status}`,
  'session.model': ({ model }) => `Model: ${model}`,
  'session.adapter': ({ adapter }) => `Adapter: ${adapter}`,
  'session.messageCount': ({ count }) => `Context messages: ${count}`,
  'session.permissionMode': ({ mode }) => `Permission mode: ${mode}`,
  'session.effort': ({ effort }) => `Effort: ${effort}`,
  'session.starred': ({ starred }) => `Starred: ${starred}`,
  'session.archived': ({ archived }) => `Archived: ${archived}`,
  'session.tags': ({ tags }) => `Tags: ${tags}`,
  'session.workspace.path': ({ path }) => `Workspace: ${path}`,
  'session.workspace.mode': ({ mode }) => `Workspace mode: ${mode}`,
  'session.workspace.cleanup': ({ cleanup }) => `Cleanup: ${cleanup}`,
  'session.workspace.baseRef': ({ baseRef }) => `Base ref: ${baseRef}`,
  'session.workspace.kind.managedWorktree': 'Managed worktree',
  'session.workspace.kind.sharedWorkspace': 'Shared workspace',
  'session.workspace.kind.externalWorkspace': 'External workspace',
  'session.workspace.cleanup.deleteOnSessionDelete': 'Delete with session',
  'session.workspace.cleanup.retain': 'Retain on delete',
  'session.search.empty': 'There are no sessions to list.',
  'session.search.noResults': ({ query }) => `No sessions matched “${query}”.`,
  'session.search.listHeader': ({ count }) => `Recent sessions (${count} total):`,
  'session.search.header': ({ count, query }) => `Found ${count} matching sessions (query: ${query}):`,
  'session.search.page': ({ current, total }) => `Page ${current}/${total}`,
  'session.search.binding.current': 'current channel',
  'session.search.binding.unbound': 'unbound',
  'session.search.binding.other': ({ channelType, sessionType, channelId }) =>
    `bound to ${channelType}/${sessionType}/${channelId}`,
  'session.search.item': ({ index, id, title, status, count, model, binding }) =>
    `${index}. ${id} | ${title} | ${status} | ${count} msgs | ${model} | ${binding}`,
  'bind.notFound': ({ id }) => `Session ${id} was not found.`,
  'bind.alreadyBound': ({ id, title }) =>
    `This channel is already bound to session ${id} (${title}). Binding refreshed.`,
  'bind.success': ({ id, title }) => `This channel is now bound to session ${id} (${title}).`,
  'bind.replaced': ({ previousId }) =>
    `The previously bound session ${previousId} has been detached from this channel.`,
  'bind.transferred': ({ channelType, sessionType, channelId }) =>
    `The target session was previously bound to ${channelType}/${sessionType}/${channelId} and has been moved here.`,
  'bind.followUp': 'Send the next message in this channel to continue that session.',
  'unbind.noSession': 'No session is currently bound to this channel.',
  'unbind.success': ({ id }) => `This channel has been detached from session ${id}. The session itself was kept.`,
  'reset.success': 'Session archived and unbound. You can continue chatting to create a new session.',
  'stop.noSession': 'No active session to stop.',
  'stop.notRunning': ({ status }) => `Session status is ${status}, no need to stop.`,
  'stop.success': 'Session stopped.',
  'set.noSession': 'No session bound. Cannot modify session settings.',
  'set.permissionMode.success': ({ mode }) => `Permission mode set to ${mode}.`,
  'set.permissionMode.pending.success': ({ mode }) =>
    `Permission mode for the next session set to ${mode}. Send the next message to create a new session.`,
  'set.effort.success': ({ effort }) => `Effort set to ${effort}.`,
  'set.effort.pending.success': ({ effort }) =>
    `Effort for the next session set to ${effort}. Send the next message to create a new session.`,
  'set.model.success': ({ model }) => `Model set to ${model}. Session restarted.`,
  'set.adapter.pending.success': ({ adapter }) =>
    `Adapter for the next session set to ${adapter}. Send the next message to create a new session.`,
  'set.adapter.requiresReset': 'A session is already bound to this channel. Run /reset first, then set the adapter.'
})

const formatList = (ctx: ChannelContext, items: string[] | undefined) =>
  items != null && items.length > 0 ? items.join('、') : ctx.t('label.none')

const SESSION_SEARCH_PAGE_SIZE = 8

const PERMISSION_MODE_CHOICES = [
  {
    value: 'default',
    title: 'choice.session.permissionMode.default.title',
    description: 'choice.session.permissionMode.default.description'
  },
  {
    value: 'acceptEdits',
    title: 'choice.session.permissionMode.acceptEdits.title',
    description: 'choice.session.permissionMode.acceptEdits.description'
  },
  {
    value: 'plan',
    title: 'choice.session.permissionMode.plan.title',
    description: 'choice.session.permissionMode.plan.description'
  },
  {
    value: 'dontAsk',
    title: 'choice.session.permissionMode.dontAsk.title',
    description: 'choice.session.permissionMode.dontAsk.description'
  },
  {
    value: 'bypassPermissions',
    title: 'choice.session.permissionMode.bypassPermissions.title',
    description: 'choice.session.permissionMode.bypassPermissions.description'
  }
] as const satisfies readonly CommandArgumentChoice<SessionPermissionMode>[]

type EffortArgument = EffortLevel | 'default'

const EFFORT_CHOICES = [
  {
    value: 'default',
    title: 'choice.session.effort.default.title',
    description: 'choice.session.effort.default.description'
  },
  {
    value: 'low',
    title: 'choice.session.effort.low.title',
    description: 'choice.session.effort.low.description'
  },
  {
    value: 'medium',
    title: 'choice.session.effort.medium.title',
    description: 'choice.session.effort.medium.description'
  },
  {
    value: 'high',
    title: 'choice.session.effort.high.title',
    description: 'choice.session.effort.high.description'
  },
  {
    value: 'max',
    title: 'choice.session.effort.max.title',
    description: 'choice.session.effort.max.description'
  }
] as const satisfies readonly CommandArgumentChoice<EffortArgument>[]

type SetField = 'model' | 'adapter'
type GetField = 'model' | 'adapter' | 'permissionMode' | 'effort'

const SET_FIELD_CHOICES = [
  {
    value: 'model',
    title: 'choice.session.setField.model.title',
    description: 'choice.session.setField.model.description'
  },
  {
    value: 'adapter',
    title: 'choice.session.setField.adapter.title',
    description: 'choice.session.setField.adapter.description'
  }
] as const satisfies readonly CommandArgumentChoice<SetField>[]

const GET_FIELD_CHOICES = [
  {
    value: 'model',
    title: 'choice.session.getField.model.title',
    description: 'choice.session.getField.model.description'
  },
  {
    value: 'adapter',
    title: 'choice.session.getField.adapter.title',
    description: 'choice.session.getField.adapter.description'
  },
  {
    value: 'permissionMode',
    title: 'choice.session.getField.permissionMode.title',
    description: 'choice.session.getField.permissionMode.description'
  },
  {
    value: 'effort',
    title: 'choice.session.getField.effort.title',
    description: 'choice.session.getField.effort.description'
  }
] as const satisfies readonly CommandArgumentChoice<GetField>[]

const getBoundSessionOrReply = async (ctx: ChannelContext): Promise<Session | undefined> => {
  const session = ctx.getBoundSession()
  if (!ctx.sessionId || !session) {
    await ctx.reply(ctx.t('set.noSession'))
    return undefined
  }
  return session
}

const restartSessionWithReply = async (
  ctx: ChannelContext,
  updates: Partial<Pick<Session, 'model' | 'adapter' | 'permissionMode' | 'effort'>>,
  message: string
) => {
  ctx.updateSession(updates)
  await ctx.restartSession()
  await ctx.reply(message)
}

const formatSessionWorkspaceKind = (ctx: ChannelContext, kind: SessionWorkspace['kind']) => {
  switch (kind) {
    case 'managed_worktree':
      return ctx.t('session.workspace.kind.managedWorktree')
    case 'external_workspace':
      return ctx.t('session.workspace.kind.externalWorkspace')
    default:
      return ctx.t('session.workspace.kind.sharedWorkspace')
  }
}

const formatSessionWorkspaceCleanup = (
  ctx: ChannelContext,
  cleanupPolicy: SessionWorkspace['cleanupPolicy']
) => {
  switch (cleanupPolicy) {
    case 'delete_on_session_delete':
      return ctx.t('session.workspace.cleanup.deleteOnSessionDelete')
    default:
      return ctx.t('session.workspace.cleanup.retain')
  }
}

const formatSessionWorkspaceLines = (
  ctx: ChannelContext,
  workspace: SessionWorkspace,
  options: {
    includeBaseRef?: boolean
    includeCleanup?: boolean
  } = {}
) => {
  const lines = [
    ctx.t('session.workspace.path', { path: workspace.workspaceFolder }),
    ctx.t('session.workspace.mode', { mode: formatSessionWorkspaceKind(ctx, workspace.kind) })
  ]

  if (options.includeCleanup !== false) {
    lines.push(ctx.t('session.workspace.cleanup', {
      cleanup: formatSessionWorkspaceCleanup(ctx, workspace.cleanupPolicy)
    }))
  }

  if (options.includeBaseRef !== false && workspace.baseRef != null && workspace.baseRef.trim() !== '') {
    lines.push(ctx.t('session.workspace.baseRef', { baseRef: workspace.baseRef }))
  }

  return lines
}

const formatSessionSummary = async (ctx: ChannelContext) => {
  const { sessionId } = ctx
  if (!sessionId) {
    return ctx.t('session.noSession')
  }
  const session = ctx.getBoundSession()
  if (!session) {
    return ctx.t('session.notFound', { id: sessionId })
  }
  const workspace = await ctx.resolveSessionWorkspace(sessionId)

  return [
    ctx.t('session.title', { title: session.title ?? ctx.t('label.unnamed') }),
    ctx.t('session.status', { status: session.status ?? 'unknown' }),
    ctx.t('session.model', { model: session.model ?? ctx.t('label.notSet') }),
    ctx.t('session.adapter', { adapter: session.adapter ?? ctx.t('label.notSet') }),
    ctx.t('session.messageCount', { count: session.messageCount ?? 0 }),
    ctx.t('session.permissionMode', { mode: session.permissionMode ?? ctx.t('label.notSet') }),
    ctx.t('session.effort', { effort: session.effort ?? ctx.t('label.notSet') }),
    ctx.t('session.starred', { starred: session.isStarred ? ctx.t('label.yes') : ctx.t('label.no') }),
    ctx.t('session.archived', { archived: session.isArchived ? ctx.t('label.yes') : ctx.t('label.no') }),
    ctx.t('session.tags', { tags: formatList(ctx, session.tags) }),
    ...(workspace == null ? [] : formatSessionWorkspaceLines(ctx, workspace))
  ].join('\n')
}

const formatSearchBinding = (
  ctx: ChannelContext,
  binding: ReturnType<ChannelContext['searchSessions']>[number]['binding']
) => {
  if (binding == null) {
    return ctx.t('session.search.binding.unbound')
  }

  if (
    binding.channelType === ctx.inbound.channelType &&
    binding.sessionType === ctx.inbound.sessionType &&
    binding.channelId === ctx.inbound.channelId
  ) {
    return ctx.t('session.search.binding.current')
  }

  return ctx.t('session.search.binding.other', {
    channelType: binding.channelType,
    sessionType: binding.sessionType,
    channelId: binding.channelId
  })
}

interface SessionSearchRequest {
  page: number
  query: string
}

interface SessionSearchPage {
  text: string
  followUps: Array<{ content: string }>
}

const parseSessionSearchRequest = (rawArgs: readonly string[]): SessionSearchRequest => {
  let page = 1
  const queryTokens: string[] = []

  for (let index = 0; index < rawArgs.length; index += 1) {
    const token = rawArgs[index]
    if (token.startsWith('--page=')) {
      const parsedPage = Number.parseInt(token.slice('--page='.length), 10)
      if (Number.isFinite(parsedPage) && parsedPage > 0) {
        page = parsedPage
      }
      continue
    }

    if (token === '--page') {
      const nextToken = rawArgs[index + 1]
      const parsedPage = nextToken == null ? Number.NaN : Number.parseInt(nextToken, 10)
      if (Number.isFinite(parsedPage) && parsedPage > 0) {
        page = parsedPage
        index += 1
      }
      continue
    }

    if (token.startsWith('--query=')) {
      queryTokens.push(decodeURIComponent(token.slice('--query='.length)))
      continue
    }

    queryTokens.push(token)
  }

  return {
    page,
    query: queryTokens.join(' ').trim()
  }
}

const createSessionSearchPageCommand = (prefix: string, page: number, query: string) => {
  const parts = query === '' ? [`${prefix}session`, 'list'] : [`${prefix}session`, 'search']
  parts.push(`--page=${page}`)
  if (query !== '') {
    parts.push(`--query=${encodeURIComponent(query)}`)
  }
  return parts.join(' ')
}

const canUseSearchFollowUps = (ctx: ChannelContext) =>
  ctx.inbound.channelType === 'lark' && ctx.inbound.sessionType === 'direct'

const paginateSessionSearchResults = (
  ctx: ChannelContext,
  results: ReturnType<ChannelContext['searchSessions']>,
  request: SessionSearchRequest,
  prefix: string
): SessionSearchPage => {
  const totalPages = Math.max(1, Math.ceil(results.length / SESSION_SEARCH_PAGE_SIZE))
  const currentPage = Math.min(Math.max(request.page, 1), totalPages)
  const startIndex = (currentPage - 1) * SESSION_SEARCH_PAGE_SIZE
  const displayed = results.slice(startIndex, startIndex + SESSION_SEARCH_PAGE_SIZE)

  const lines = [
    request.query === ''
      ? ctx.t('session.search.listHeader', { count: results.length })
      : ctx.t('session.search.header', { count: results.length, query: request.query }),
    ctx.t('session.search.page', { current: currentPage, total: totalPages }),
    ...displayed.map((result, index) =>
      ctx.t('session.search.item', {
        index: startIndex + index + 1,
        id: result.session.id,
        title: result.session.title ?? ctx.t('label.unnamed'),
        status: result.session.status ?? 'unknown',
        count: result.session.messageCount ?? 0,
        model: result.session.model ?? ctx.t('label.notSet'),
        binding: formatSearchBinding(ctx, result.binding)
      })
    )
  ]

  const followUps = [] as Array<{ content: string }>
  if (totalPages > 1 && currentPage > 1) {
    followUps.push({ content: createSessionSearchPageCommand(prefix, currentPage - 1, request.query) })
  }
  if (totalPages > 1 && currentPage < totalPages) {
    followUps.push({ content: createSessionSearchPageCommand(prefix, currentPage + 1, request.query) })
  }

  return {
    text: lines.join('\n'),
    followUps
  }
}

export const sessionCommands = (getPrefix: (ctx: ChannelContext) => string = () => '/') => [
  command<ChannelContext>('session')
    .alias('status')
    .description('cmd.session.description')
    .subcommand(
      command<ChannelContext>('search')
        .alias('find', 'list')
        .description('cmd.session.search.description')
        .adminOnly()
        .argument(variadicArg('query'))
        .action(async ({ ctx, rawArgs }) => {
          const request = parseSessionSearchRequest(rawArgs)
          const results = ctx.searchSessions(request.query)
          if (results.length === 0) {
            await ctx.reply(
              request.query === ''
                ? ctx.t('session.search.empty')
                : ctx.t('session.search.noResults', { query: request.query })
            )
            return
          }

          const searchPage = paginateSessionSearchResults(ctx, results, request, getPrefix(ctx))
          const replyResult = await ctx.reply(searchPage.text)
          if (canUseSearchFollowUps(ctx) && searchPage.followUps.length > 0) {
            await ctx.pushFollowUps({ messageId: replyResult?.messageId, followUps: searchPage.followUps })
          }
        })
    )
    .subcommand(
      command<ChannelContext>('bind')
        .alias('attach')
        .description('cmd.session.bind.description')
        .adminOnly()
        .argument(requiredArg('sessionId'))
        .action(async ({ ctx, args: [sessionId] }) => {
          const result = ctx.bindSession(sessionId as string)
          if (result.session == null) {
            await ctx.reply(ctx.t('bind.notFound', { id: sessionId }))
            return
          }

          const lines = [
            ctx.t(result.alreadyBound ? 'bind.alreadyBound' : 'bind.success', {
              id: result.session.id,
              title: result.session.title ?? ctx.t('label.unnamed')
            })
          ]
          if (result.previousSessionId != null) {
            lines.push(ctx.t('bind.replaced', { previousId: result.previousSessionId }))
          }
          if (result.transferredFrom != null) {
            lines.push(ctx.t('bind.transferred', {
              channelType: result.transferredFrom.channelType,
              sessionType: result.transferredFrom.sessionType,
              channelId: result.transferredFrom.channelId
            }))
          }
          const workspace = await ctx.resolveSessionWorkspace(result.session.id)
          if (workspace != null) {
            lines.push(...formatSessionWorkspaceLines(ctx, workspace, {
              includeCleanup: false
            }))
          }
          lines.push(ctx.t('bind.followUp'))
          await ctx.reply(lines.join('\n'))
        })
    )
    .subcommand(
      command<ChannelContext>('unbind')
        .alias('detach')
        .description('cmd.session.unbind.description')
        .adminOnly()
        .action(async ({ ctx }) => {
          const result = ctx.unbindSession()
          if (result.sessionId == null) {
            await ctx.reply(ctx.t('unbind.noSession'))
            return
          }
          await ctx.reply(ctx.t('unbind.success', { id: result.sessionId }))
        })
    )
    .action(async ({ ctx }) => {
      await ctx.reply(await formatSessionSummary(ctx))
    }),

  command<ChannelContext>('reset')
    .alias('unbind')
    .description('cmd.reset.description')
    .adminOnly()
    .action(async ({ ctx }) => {
      ctx.resetSession()
      await ctx.reply(ctx.t('reset.success'))
    }),

  command<ChannelContext>('stop')
    .description('cmd.stop.description')
    .adminOnly()
    .action(async ({ ctx }) => {
      const session = ctx.getBoundSession()
      if (!ctx.sessionId || !session) {
        await ctx.reply(ctx.t('stop.noSession'))
        return
      }
      if (session.status !== 'running' && session.status !== 'waiting_input') {
        await ctx.reply(ctx.t('stop.notRunning', { status: session.status ?? 'unknown' }))
        return
      }
      ctx.stopSession()
      await ctx.reply(ctx.t('stop.success'))
    }),

  command<ChannelContext>('permissionMode')
    .description('cmd.permissionMode.description')
    .adminOnly()
    .argument(requiredArg('mode', { choices: PERMISSION_MODE_CHOICES }))
    .action(async ({ ctx, args: [permissionMode] }) => {
      const session = ctx.getBoundSession()
      if (!ctx.sessionId || !session) {
        ctx.setChannelPermissionModePreference(permissionMode)
        await ctx.reply(ctx.t('set.permissionMode.pending.success', { mode: permissionMode }))
        return
      }

      await restartSessionWithReply(
        ctx,
        { permissionMode },
        ctx.t('set.permissionMode.success', { mode: permissionMode })
      )
    }),

  command<ChannelContext>('effort')
    .description('cmd.effort.description')
    .adminOnly()
    .argument(requiredArg('effort', { choices: EFFORT_CHOICES }))
    .action(async ({ ctx, args: [effort] }) => {
      const nextEffort = effort === 'default' ? undefined : effort
      const effortLabel = nextEffort ?? ctx.t('choice.session.effort.default.title')
      const session = ctx.getBoundSession()
      if (!ctx.sessionId || !session) {
        ctx.setChannelEffortPreference(nextEffort)
        await ctx.reply(ctx.t('set.effort.pending.success', { effort: effortLabel }))
        return
      }

      await restartSessionWithReply(
        ctx,
        { effort: nextEffort },
        ctx.t('set.effort.success', { effort: effortLabel })
      )
    }),

  command<ChannelContext>('get')
    .description('cmd.get.description')
    .argument(requiredArg('field', { choices: GET_FIELD_CHOICES }))
    .action(async ({ ctx, args: [field] }) => {
      if (field === 'adapter') {
        const session = ctx.getBoundSession()
        const adapter = session?.adapter ?? ctx.getChannelAdapterPreference()
        await ctx.reply(ctx.t('session.adapter', { adapter: adapter ?? ctx.t('label.notSet') }))
        return
      }

      if (field === 'model') {
        const session = await getBoundSessionOrReply(ctx)
        if (!session) return
        await ctx.reply(ctx.t('session.model', { model: session.model ?? ctx.t('label.notSet') }))
        return
      }

      if (field === 'effort') {
        const session = ctx.getBoundSession()
        const effort = session?.effort ?? ctx.getChannelEffortPreference()
        await ctx.reply(ctx.t('session.effort', { effort: effort ?? ctx.t('label.notSet') }))
        return
      }

      const session = ctx.getBoundSession()
      const permissionMode = session?.permissionMode ?? ctx.getChannelPermissionModePreference()
      await ctx.reply(ctx.t('session.permissionMode', { mode: permissionMode ?? ctx.t('label.notSet') }))
    }),

  command<ChannelContext>('set')
    .description('cmd.set.description')
    .adminOnly()
    .argument(requiredArg('field', { choices: SET_FIELD_CHOICES }))
    .argument(restArg('name'))
    .action(async ({ ctx, args: [field, value] }) => {
      if (field === 'adapter') {
        const session = ctx.getBoundSession()
        if (ctx.sessionId && session) {
          await ctx.reply(ctx.t('set.adapter.requiresReset'))
          return
        }

        ctx.setChannelAdapterPreference(value as string)
        await ctx.reply(ctx.t('set.adapter.pending.success', { adapter: value as string }))
        return
      }

      const session = await getBoundSessionOrReply(ctx)
      if (!session) return

      if (field === 'model') {
        await restartSessionWithReply(
          ctx,
          { model: value as string },
          ctx.t('set.model.success', { model: value as string })
        )
      }
    })
]
