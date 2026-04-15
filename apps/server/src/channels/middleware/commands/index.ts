import type { ChannelContext, ChannelMiddleware } from '../@types'
import { defineMessages } from '../i18n'
import { isAdmin } from './access'
import { accessCommands } from './cmd.access'
import { generalCommands } from './cmd.general'
import { sessionCommands } from './cmd.session'
import type { AnyCommandSpec } from './command-system'
import { parseCommandString } from './command-system'
import { splitCommand } from './utils'

let _sharedMessagesRegistered = false

const ensureSharedMessagesRegistered = (ctx: ChannelContext) => {
  if (_sharedMessagesRegistered) return

  const register = ctx.defineMessages ?? defineMessages
  register('zh', {
    'system.unknownCommand': ({ token }) => `未知指令：${token}`,
    'system.emptyCommand': '空指令。',
    'system.missingSubcommand': ({ path }) => `缺少子指令：${path}`,
    'system.unknownSubcommand': ({ token }) => `未知子指令：${token}`,
    'system.missingArgument': ({ name }) => `缺少参数：<${name}>`,
    'system.tooManyArguments': ({ extra }) => `参数过多：${extra}`,
    'system.invalidArgument': ({ message }) => `${message}`,
    'system.usage': ({ usage }) => `用法：${usage}`,
    'system.helpHint': '请发送 {prefix}help 查看支持的命令。',
    'system.executionFailed': '指令执行失败，请稍后重试。',
    'system.noPermission': '您没有权限执行该操作，只有管理员才能执行该指令。',
    'system.supportedCommands': '支持的指令：',
    'system.choiceError': ({ value, choices }) => `参数值无效：${value}。支持：${choices}`,
    'interaction.response.empty': '当前问题只接受文本回复，请直接回复文字。',
    'interaction.response.invalidSingle': ({ choices }) =>
      `未识别你的回复，请回复以下任一选项的文本或序号：\n${choices}`,
    'interaction.response.invalidMulti': ({ invalid, choices }) =>
      `未识别这些选项：${invalid}。\n请回复以下选项的文本或序号，多个选项可用逗号、顿号或换行分隔：\n${choices}`,
    'label.usage': '用法',
    'label.arguments': '参数',
    'label.choices': '可选值',
    'label.description': '说明',
    'label.aliases': '别名',
    'label.subcommands': '子指令',
    'label.none': '无',
    'label.yes': '是',
    'label.no': '否',
    'label.admin': '管理员',
    'label.user': '普通用户',
    'label.group': '群聊',
    'label.direct': '私聊',
    'label.notSet': '未设置',
    'label.unnamed': '未命名会话'
  })
  register('en', {
    'system.unknownCommand': ({ token }) => `Unknown command: ${token}`,
    'system.emptyCommand': 'Empty command.',
    'system.missingSubcommand': ({ path }) => `Missing subcommand: ${path}`,
    'system.unknownSubcommand': ({ token }) => `Unknown subcommand: ${token}`,
    'system.missingArgument': ({ name }) => `Missing argument: <${name}>`,
    'system.tooManyArguments': ({ extra }) => `Too many arguments: ${extra}`,
    'system.invalidArgument': ({ message }) => `${message}`,
    'system.usage': ({ usage }) => `Usage: ${usage}`,
    'system.helpHint': 'Send {prefix}help to see available commands.',
    'system.executionFailed': 'Command execution failed, please try again later.',
    'system.noPermission': 'You do not have permission. Only admins can execute this command.',
    'system.supportedCommands': 'Available commands:',
    'system.choiceError': ({ value, choices }) => `Invalid value: ${value}. Supported: ${choices}`,
    'interaction.response.empty': 'This question only accepts text replies. Please reply with plain text.',
    'interaction.response.invalidSingle': ({ choices }) =>
      `Your reply did not match any option. Reply with one of the option labels or numbers:\n${choices}`,
    'interaction.response.invalidMulti': ({ invalid, choices }) =>
      `These selections were not recognized: ${invalid}.\nReply with option labels or numbers, separated by commas or new lines:\n${choices}`,
    'label.usage': 'Usage',
    'label.arguments': 'Arguments',
    'label.choices': 'Choices',
    'label.description': 'Description',
    'label.aliases': 'Aliases',
    'label.subcommands': 'Subcommands',
    'label.none': 'None',
    'label.yes': 'Yes',
    'label.no': 'No',
    'label.admin': 'Admin',
    'label.user': 'User',
    'label.group': 'Group',
    'label.direct': 'Direct',
    'label.notSet': 'Not set',
    'label.unnamed': 'Unnamed session'
  })

  _sharedMessagesRegistered = true
}

const getPrefix = (ctx: ChannelContext): string =>
  ((ctx.config as Record<string, unknown> | undefined)?.commandPrefix as string | undefined) ?? '/'

let _allCommands: AnyCommandSpec<ChannelContext>[] | undefined

const getAllCommands = (): AnyCommandSpec<ChannelContext>[] => {
  if (_allCommands) return _allCommands
  _allCommands = [
    ...generalCommands(getPrefix, getAllCommands),
    ...sessionCommands(getPrefix),
    ...accessCommands()
  ]
  return _allCommands
}

const formatParseError = (ctx: ChannelContext, prefix: string, message: string, usage?: string) => {
  if (!usage) {
    return `${message}\n${ctx.t('system.helpHint').replace('{prefix}', prefix)}`
  }
  return `${message}\n${ctx.t('label.usage')}：${usage}`
}

const handleCommand = async (ctx: ChannelContext) => {
  const prefix = getPrefix(ctx)
  const commands = getAllCommands()
  const parsed = parseCommandString(commands, ctx.commandText, { t: ctx.t, prefix })

  if (!parsed.ok) {
    if (parsed.code === 'unknown-command') return false
    await ctx.reply(formatParseError(ctx, prefix, parsed.message, parsed.usage))
    return true
  }

  if (parsed.command.permission === 'admin' && !isAdmin(ctx)) {
    await ctx.reply(ctx.t('system.noPermission'))
    return true
  }

  await parsed.command.action?.({
    ctx,
    args: [...parsed.args],
    rawArgs: parsed.rawArgs,
    commandPath: parsed.commandPath,
    usage: parsed.usage
  })
  return true
}

export const channelCommandMiddleware: ChannelMiddleware = async (ctx, next) => {
  ensureSharedMessagesRegistered(ctx)
  const prefix = getPrefix(ctx)
  const command = splitCommand(ctx.commandText)[0] ?? ''
  if (command === '' || !command.startsWith(prefix)) {
    await next()
    return
  }

  await ctx.inbound.ack?.().catch(() => undefined)
  const handled = await handleCommand(ctx).catch(async (error) => {
    console.error('[channels] command execution failed:', error)
    await ctx.reply(ctx.t('system.executionFailed'))
    return true
  })
  await ctx.inbound.unack?.().catch(() => undefined)

  if (!handled) {
    await next()
  }
}
