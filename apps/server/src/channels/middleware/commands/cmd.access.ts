import type { ChannelContext } from '../@types'
import { checkChannelAccess } from '../access-control'
import { defineMessages } from '../i18n'
import { addToAccessList, isAdmin, removeFromAccessList, setAccessField } from './access'
import type { CommandArgumentChoice } from './command-system'
import { command, requiredArg } from './command-system'

defineMessages('zh', {
  'cmd.access.description': '查看当前频道权限配置',
  'cmd.admins.description': '查看管理员列表',
  'cmd.admin.description': '管理频道管理员',
  'cmd.admin.add.description': '添加频道管理员',
  'cmd.admin.remove.description': '移除频道管理员',
  'cmd.allow.description': '配置发送者、群组或聊天类型的允许策略',
  'cmd.block.description': '配置发送者或群组的阻止策略',
  'choice.access.allow.sender.title': '发送者',
  'choice.access.allow.sender.description': '将指定发送者加入白名单。',
  'choice.access.allow.group.title': '群组',
  'choice.access.allow.group.description': '将指定群组加入白名单。',
  'choice.access.allow.private.title': '私聊',
  'choice.access.allow.private.description': '开启或关闭私聊访问。',
  'choice.access.allow.groupchat.title': '群聊',
  'choice.access.allow.groupchat.description': '开启或关闭群聊访问。',
  'choice.access.block.sender.title': '发送者',
  'choice.access.block.sender.description': '将指定发送者加入黑名单。',
  'choice.access.block.group.title': '群组',
  'choice.access.block.group.description': '将指定群组加入黑名单。',
  'choice.switch.on.title': '开启',
  'choice.switch.on.description': '启用该开关。',
  'choice.switch.off.title': '关闭',
  'choice.switch.off.description': '禁用该开关。',
  'access.admins': ({ list }) => `管理员：${list}`,
  'access.sender': ({ id }) => `发送者：${id}`,
  'access.role': ({ role }) => `身份：${role}`,
  'access.sessionType': ({ type }) => `会话类型：${type}`,
  'access.result': ({ result }) => `当前访问结果：${result}`,
  'access.allowPrivateChat': ({ enabled }) => `允许私聊：${enabled}`,
  'access.allowGroupChat': ({ enabled }) => `允许群聊：${enabled}`,
  'access.allowedGroups': ({ list }) => `群组白名单：${list}`,
  'access.blockedGroups': ({ list }) => `群组黑名单：${list}`,
  'access.allowedSenders': ({ list }) => `发送者白名单：${list}`,
  'access.blockedSenders': ({ list }) => `发送者黑名单：${list}`,
  'access.allowed': '允许',
  'access.denied': '拒绝',
  'admin.added': ({ id }) => `已添加管理员：${id}`,
  'admin.removed': ({ id }) => `已移除管理员：${id}`,
  'admin.list': ({ list }) => `管理员列表：${list}`,
  'allow.sender.added': ({ id }) => `已加入发送者白名单：${id}`,
  'allow.group.added': ({ id }) => `已加入群组白名单：${id}`,
  'allow.private.on': '已开启私聊访问。',
  'allow.private.off': '已关闭私聊访问。',
  'allow.groupchat.on': '已开启群聊访问。',
  'allow.groupchat.off': '已关闭群聊访问。',
  'block.sender.added': ({ id }) => `已加入发送者黑名单：${id}`,
  'block.group.added': ({ id }) => `已加入群组黑名单：${id}`
})

defineMessages('en', {
  'cmd.access.description': 'Show channel access configuration',
  'cmd.admins.description': 'Show admin list',
  'cmd.admin.description': 'Manage channel admins',
  'cmd.admin.add.description': 'Add a channel admin',
  'cmd.admin.remove.description': 'Remove a channel admin',
  'cmd.allow.description': 'Configure sender, group, or chat-type allow rules',
  'cmd.block.description': 'Configure sender or group block rules',
  'choice.access.allow.sender.title': 'Sender',
  'choice.access.allow.sender.description': 'Add the sender to the allowlist.',
  'choice.access.allow.group.title': 'Group',
  'choice.access.allow.group.description': 'Add the group to the allowlist.',
  'choice.access.allow.private.title': 'Private chat',
  'choice.access.allow.private.description': 'Enable or disable private chat access.',
  'choice.access.allow.groupchat.title': 'Group chat',
  'choice.access.allow.groupchat.description': 'Enable or disable group chat access.',
  'choice.access.block.sender.title': 'Sender',
  'choice.access.block.sender.description': 'Add the sender to the blocklist.',
  'choice.access.block.group.title': 'Group',
  'choice.access.block.group.description': 'Add the group to the blocklist.',
  'choice.switch.on.title': 'On',
  'choice.switch.on.description': 'Enable the switch.',
  'choice.switch.off.title': 'Off',
  'choice.switch.off.description': 'Disable the switch.',
  'access.admins': ({ list }) => `Admins: ${list}`,
  'access.sender': ({ id }) => `Sender: ${id}`,
  'access.role': ({ role }) => `Role: ${role}`,
  'access.sessionType': ({ type }) => `Session type: ${type}`,
  'access.result': ({ result }) => `Access result: ${result}`,
  'access.allowPrivateChat': ({ enabled }) => `Allow private chat: ${enabled}`,
  'access.allowGroupChat': ({ enabled }) => `Allow group chat: ${enabled}`,
  'access.allowedGroups': ({ list }) => `Group allowlist: ${list}`,
  'access.blockedGroups': ({ list }) => `Group blocklist: ${list}`,
  'access.allowedSenders': ({ list }) => `Sender allowlist: ${list}`,
  'access.blockedSenders': ({ list }) => `Sender blocklist: ${list}`,
  'access.allowed': 'Allowed',
  'access.denied': 'Denied',
  'admin.added': ({ id }) => `Admin added: ${id}`,
  'admin.removed': ({ id }) => `Admin removed: ${id}`,
  'admin.list': ({ list }) => `Admin list: ${list}`,
  'allow.sender.added': ({ id }) => `Added to sender allowlist: ${id}`,
  'allow.group.added': ({ id }) => `Added to group allowlist: ${id}`,
  'allow.private.on': 'Private chat access enabled.',
  'allow.private.off': 'Private chat access disabled.',
  'allow.groupchat.on': 'Group chat access enabled.',
  'allow.groupchat.off': 'Group chat access disabled.',
  'block.sender.added': ({ id }) => `Added to sender blocklist: ${id}`,
  'block.group.added': ({ id }) => `Added to group blocklist: ${id}`
})

const formatList = (ctx: ChannelContext, items: string[] | undefined) =>
  items != null && items.length > 0 ? items.join('、') : ctx.t('label.none')

const BOOLEAN_SWITCH_CHOICES = [
  {
    value: 'on',
    title: 'choice.switch.on.title',
    description: 'choice.switch.on.description'
  },
  {
    value: 'off',
    title: 'choice.switch.off.title',
    description: 'choice.switch.off.description'
  }
] as const satisfies readonly CommandArgumentChoice<'on' | 'off'>[]

const ALLOW_FIELD_CHOICES: readonly CommandArgumentChoice[] = [
  {
    value: 'sender',
    title: 'choice.access.allow.sender.title',
    description: 'choice.access.allow.sender.description'
  },
  {
    value: 'group',
    title: 'choice.access.allow.group.title',
    description: 'choice.access.allow.group.description'
  },
  {
    value: 'private',
    title: 'choice.access.allow.private.title',
    description: 'choice.access.allow.private.description'
  },
  {
    value: 'groupchat',
    title: 'choice.access.allow.groupchat.title',
    description: 'choice.access.allow.groupchat.description'
  }
] as const

const BLOCK_FIELD_CHOICES: readonly CommandArgumentChoice[] = [
  {
    value: 'sender',
    title: 'choice.access.block.sender.title',
    description: 'choice.access.block.sender.description'
  },
  {
    value: 'group',
    title: 'choice.access.block.group.title',
    description: 'choice.access.block.group.description'
  }
] as const

const updateAllowSwitch = async (ctx: ChannelContext, field: 'private' | 'groupchat', value: string) => {
  const state = requiredArg('value', { choices: BOOLEAN_SWITCH_CHOICES }).parse(value)
  const enabled = state === 'on'

  if (field === 'private') {
    await setAccessField(ctx, 'allowPrivateChat', enabled)
    await ctx.reply(ctx.t(enabled ? 'allow.private.on' : 'allow.private.off'))
    return
  }

  await setAccessField(ctx, 'allowGroupChat', enabled)
  await ctx.reply(ctx.t(enabled ? 'allow.groupchat.on' : 'allow.groupchat.off'))
}

const formatAccessSummary = (ctx: ChannelContext) => {
  const access = ctx.config?.access
  const senderId = ctx.inbound.senderId ?? '?'
  const accessAllowed = checkChannelAccess(ctx.inbound, ctx.config)

  return [
    ctx.t('access.sender', { id: senderId }),
    ctx.t('access.role', { role: isAdmin(ctx) ? ctx.t('label.admin') : ctx.t('label.user') }),
    ctx.t('access.sessionType', {
      type: ctx.inbound.sessionType === 'group' ? ctx.t('label.group') : ctx.t('label.direct')
    }),
    ctx.t('access.result', { result: accessAllowed ? ctx.t('access.allowed') : ctx.t('access.denied') }),
    ctx.t('access.admins', { list: formatList(ctx, access?.admins) }),
    ctx.t('access.allowPrivateChat', {
      enabled: access?.allowPrivateChat === false ? ctx.t('label.no') : ctx.t('label.yes')
    }),
    ctx.t('access.allowGroupChat', {
      enabled: access?.allowGroupChat === false ? ctx.t('label.no') : ctx.t('label.yes')
    }),
    ctx.t('access.allowedGroups', { list: formatList(ctx, access?.allowedGroups) }),
    ctx.t('access.blockedGroups', { list: formatList(ctx, access?.blockedGroups) }),
    ctx.t('access.allowedSenders', { list: formatList(ctx, access?.allowedSenders) }),
    ctx.t('access.blockedSenders', { list: formatList(ctx, access?.blockedSenders) })
  ].join('\n')
}

export const accessCommands = () => [
  command<ChannelContext>('access')
    .description('cmd.access.description')
    .action(async ({ ctx }) => {
      await ctx.reply(formatAccessSummary(ctx))
    }),

  command<ChannelContext>('admins')
    .description('cmd.admins.description')
    .action(async ({ ctx }) => {
      await ctx.reply(ctx.t('admin.list', { list: formatList(ctx, ctx.config?.access?.admins) }))
    }),

  command<ChannelContext>('admin')
    .description('cmd.admin.description')
    .subcommand(
      command<ChannelContext>('add')
        .description('cmd.admin.add.description')
        .adminOnly()
        .argument(requiredArg('senderId'))
        .action(async ({ ctx, args: [senderId] }) => {
          await addToAccessList(ctx, 'admins', senderId as string)
          await ctx.reply(ctx.t('admin.added', { id: senderId as string }))
        })
    )
    .subcommand(
      command<ChannelContext>('remove')
        .description('cmd.admin.remove.description')
        .adminOnly()
        .argument(requiredArg('senderId'))
        .action(async ({ ctx, args: [senderId] }) => {
          await removeFromAccessList(ctx, 'admins', senderId as string)
          await ctx.reply(ctx.t('admin.removed', { id: senderId as string }))
        })
    )
    .build(),

  command<ChannelContext>('allow')
    .description('cmd.allow.description')
    .adminOnly()
    .argument(requiredArg('field', { choices: ALLOW_FIELD_CHOICES }))
    .argument(requiredArg('value'))
    .action(async ({ ctx, args: [field, value] }) => {
      if (field === 'sender') {
        await addToAccessList(ctx, 'allowedSenders', value as string)
        await ctx.reply(ctx.t('allow.sender.added', { id: value as string }))
        return
      }

      if (field === 'group') {
        await addToAccessList(ctx, 'allowedGroups', value as string)
        await ctx.reply(ctx.t('allow.group.added', { id: value as string }))
        return
      }

      if (field === 'private' || field === 'groupchat') {
        await updateAllowSwitch(ctx, field, value as string)
      }
    }),

  command<ChannelContext>('block')
    .description('cmd.block.description')
    .adminOnly()
    .argument(requiredArg('field', { choices: BLOCK_FIELD_CHOICES }))
    .argument(requiredArg('value'))
    .action(async ({ ctx, args: [field, value] }) => {
      if (field === 'sender') {
        await addToAccessList(ctx, 'blockedSenders', value as string)
        await ctx.reply(ctx.t('block.sender.added', { id: value as string }))
        return
      }

      await addToAccessList(ctx, 'blockedGroups', value as string)
      await ctx.reply(ctx.t('block.group.added', { id: value as string }))
    })
]
