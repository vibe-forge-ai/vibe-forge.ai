import type { Session, SessionPermissionMode } from '@vibe-forge/core'

import type { ChannelContext } from '../@types'
import { defineMessages } from '../i18n'
import type { CommandArgumentChoice } from './command-system'
import { command, requiredArg, restArg } from './command-system'

defineMessages('zh', {
  'cmd.session.description': '查看当前会话状态',
  'cmd.reset.description': '归档并解绑当前会话',
  'cmd.stop.description': '停止当前运行中的会话',
  'cmd.permissionMode.description': '设置当前会话权限模式，或在无会话时设置下一次会话的权限模式',
  'cmd.get.description': '查看当前会话的模型、适配器或权限模式',
  'cmd.set.description': '修改当前会话的模型，或在无会话时设置下一次会话的适配器',
  'choice.session.getField.model.title': '模型',
  'choice.session.getField.model.description': '读取当前会话使用的模型名称。',
  'choice.session.getField.adapter.title': '适配器',
  'choice.session.getField.adapter.description': '读取当前会话绑定的适配器。',
  'choice.session.getField.permissionMode.title': '权限模式',
  'choice.session.getField.permissionMode.description': '读取当前会话的权限策略。',
  'choice.session.setField.model.title': '模型',
  'choice.session.setField.model.description': '修改当前会话的模型并立即重启。',
  'choice.session.setField.adapter.title': '适配器',
  'choice.session.setField.adapter.description': '在当前频道无会话时，设置下一次创建会话使用的适配器。',
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
  'session.starred': ({ starred }) => `星标：${starred}`,
  'session.archived': ({ archived }) => `归档：${archived}`,
  'session.tags': ({ tags }) => `标签：${tags}`,
  'reset.success': '已归档并解绑当前会话，可以继续对话创建新会话。',
  'stop.noSession': '当前频道没有可停止的会话。',
  'stop.notRunning': ({ status }) => `当前会话状态为 ${status}，无需停止。`,
  'stop.success': '已停止当前会话。',
  'set.noSession': '当前频道没有已绑定会话，无法修改会话设置。',
  'set.permissionMode.success': ({ mode }) => `已将权限模式设置为 ${mode}。`,
  'set.permissionMode.pending.success': ({ mode }) => `已将下次会话的权限模式设置为 ${mode}。请发送下一条消息创建新会话。`,
  'set.model.success': ({ model }) => `已设置模型为 ${model}，并重启当前会话。`,
  'set.adapter.pending.success': ({ adapter }) => `已将下次会话的适配器设置为 ${adapter}。请发送下一条消息创建新会话。`,
  'set.adapter.requiresReset': '当前频道已有会话，无法切换适配器。请先执行 /reset 重置会话，再设置适配器。'
})

defineMessages('en', {
  'cmd.session.description': 'Show current session status',
  'cmd.reset.description': 'Archive and unbind current session',
  'cmd.stop.description': 'Stop the current running session',
  'cmd.permissionMode.description': 'Set the current session permission mode, or set the next-session permission mode when no session is bound',
  'cmd.get.description': 'View current session model, adapter, or permission mode',
  'cmd.set.description': 'Set the current session model, or set the adapter for the next session when no session is bound',
  'choice.session.getField.model.title': 'Model',
  'choice.session.getField.model.description': 'Read the model currently used by the session.',
  'choice.session.getField.adapter.title': 'Adapter',
  'choice.session.getField.adapter.description': 'Read the adapter currently bound to the session.',
  'choice.session.getField.permissionMode.title': 'Permission mode',
  'choice.session.getField.permissionMode.description': 'Read the current session permission strategy.',
  'choice.session.setField.model.title': 'Model',
  'choice.session.setField.model.description': 'Change the session model and restart immediately.',
  'choice.session.setField.adapter.title': 'Adapter',
  'choice.session.setField.adapter.description': 'When no session is bound in this channel, set the adapter used for the next session.',
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
  'session.starred': ({ starred }) => `Starred: ${starred}`,
  'session.archived': ({ archived }) => `Archived: ${archived}`,
  'session.tags': ({ tags }) => `Tags: ${tags}`,
  'reset.success': 'Session archived and unbound. You can continue chatting to create a new session.',
  'stop.noSession': 'No active session to stop.',
  'stop.notRunning': ({ status }) => `Session status is ${status}, no need to stop.`,
  'stop.success': 'Session stopped.',
  'set.noSession': 'No session bound. Cannot modify session settings.',
  'set.permissionMode.success': ({ mode }) => `Permission mode set to ${mode}.`,
  'set.permissionMode.pending.success': ({ mode }) =>
    `Permission mode for the next session set to ${mode}. Send the next message to create a new session.`,
  'set.model.success': ({ model }) => `Model set to ${model}. Session restarted.`,
  'set.adapter.pending.success': ({ adapter }) => `Adapter for the next session set to ${adapter}. Send the next message to create a new session.`,
  'set.adapter.requiresReset': 'A session is already bound to this channel. Run /reset first, then set the adapter.'
})

const formatList = (ctx: ChannelContext, items: string[] | undefined) =>
  items != null && items.length > 0 ? items.join('、') : ctx.t('label.none')

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

type SetField = 'model' | 'adapter'
type GetField = 'model' | 'adapter' | 'permissionMode'

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
  updates: Partial<Pick<Session, 'model' | 'adapter' | 'permissionMode'>>,
  message: string
) => {
  ctx.updateSession(updates)
  await ctx.restartSession()
  await ctx.reply(message)
}

const formatSessionSummary = (ctx: ChannelContext) => {
  const { sessionId } = ctx
  if (!sessionId) {
    return ctx.t('session.noSession')
  }
  const session = ctx.getBoundSession()
  if (!session) {
    return ctx.t('session.notFound', { id: sessionId })
  }
  return [
    ctx.t('session.title', { title: session.title ?? ctx.t('label.unnamed') }),
    ctx.t('session.status', { status: session.status ?? 'unknown' }),
    ctx.t('session.model', { model: session.model ?? ctx.t('label.notSet') }),
    ctx.t('session.adapter', { adapter: session.adapter ?? ctx.t('label.notSet') }),
    ctx.t('session.messageCount', { count: session.messageCount ?? 0 }),
    ctx.t('session.permissionMode', { mode: session.permissionMode ?? ctx.t('label.notSet') }),
    ctx.t('session.starred', { starred: session.isStarred ? ctx.t('label.yes') : ctx.t('label.no') }),
    ctx.t('session.archived', { archived: session.isArchived ? ctx.t('label.yes') : ctx.t('label.no') }),
    ctx.t('session.tags', { tags: formatList(ctx, session.tags) })
  ].join('\n')
}

export const sessionCommands = () => [
  command<ChannelContext>('session')
    .alias('status')
    .description('cmd.session.description')
    .action(async ({ ctx }) => {
      await ctx.reply(formatSessionSummary(ctx))
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
