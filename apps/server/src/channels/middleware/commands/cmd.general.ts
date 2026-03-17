import type { ChannelContext } from '../@types'
import type { LanguageCode } from '../i18n'
import { defineMessages } from '../i18n'
import { isAdmin, updateChannelConfig } from './access'
import type { AnyCommandSpec, CommandArgumentChoice, CommandArgumentSpec } from './command-system'
import { command, formatUsage, requiredArg, variadicArg } from './command-system'

defineMessages('zh', {
  'cmd.help.description': '查看指令列表或某个指令的用法',
  'cmd.whoami.description': '查看当前身份与会话上下文',
  'cmd.lang.description': '切换当前频道的提示语言',
  'cmd.lang.success': ({ lang }) => `已切换语言为 ${lang}。`,
  'choice.lang.zh.title': '中文',
  'choice.lang.zh.description': '使用中文返回命令帮助与执行结果。',
  'choice.lang.en.title': '英文',
  'choice.lang.en.description': 'Use English for command help and responses.',
  'whoami.sender': ({ id }) => `发送者：${id}`,
  'whoami.role': ({ role }) => `身份：${role}`,
  'whoami.sessionType': ({ type }) => `会话类型：${type}`,
  'whoami.channelId': ({ id }) => `频道 ID：${id}`,
  'whoami.bound': ({ bound }) => `当前已绑定会话：${bound}`
})

defineMessages('en', {
  'cmd.help.description': 'Show command list or usage of a specific command',
  'cmd.whoami.description': 'Show current identity and session context',
  'cmd.lang.description': 'Switch channel prompt language',
  'cmd.lang.success': ({ lang }) => `Language switched to ${lang}.`,
  'choice.lang.zh.title': 'Chinese',
  'choice.lang.zh.description': 'Use Chinese for command help and responses.',
  'choice.lang.en.title': 'English',
  'choice.lang.en.description': 'Use English for command help and responses.',
  'whoami.sender': ({ id }) => `Sender: ${id}`,
  'whoami.role': ({ role }) => `Role: ${role}`,
  'whoami.sessionType': ({ type }) => `Session type: ${type}`,
  'whoami.channelId': ({ id }) => `Channel ID: ${id}`,
  'whoami.bound': ({ bound }) => `Session bound: ${bound}`
})

// ── Help formatting ─────────────────────────────────────────────────────────

interface FormatHelpOptions {
  t: (key: string, args?: Record<string, string | number | boolean | undefined>) => string
  prefix?: string
  isAdmin?: boolean
}

const LANGUAGE_CHOICES: readonly CommandArgumentChoice<LanguageCode>[] = [
  {
    value: 'zh',
    title: 'choice.lang.zh.title',
    description: 'choice.lang.zh.description'
  },
  {
    value: 'en',
    title: 'choice.lang.en.title',
    description: 'choice.lang.en.description'
  }
] as const

const formatArgumentHelp = (
  argument: CommandArgumentSpec,
  translate: (key: string, args?: Record<string, string | number | boolean | undefined>) => string
) => {
  const usage = formatUsage({
    name: 'arg',
    aliases: [],
    descriptionKey: undefined,
    permission: 'everyone',
    args: [argument],
    subcommands: [],
    action: undefined
  }).replace('/arg ', '')

  const lines = [
    argument.description
      ? `- ${usage}：${translate(argument.description)}`
      : `- ${usage}`
  ]

  if (argument.choices && argument.choices.length > 0) {
    for (const choice of argument.choices) {
      const title = translate(choice.title)
      const description = choice.description ? translate(choice.description) : ''
      lines.push(`  - ${choice.value}：${title}${description ? `，${description}` : ''}`)
    }
  }

  return lines
}

const flattenVisible = <TContext>(
  commands: readonly AnyCommandSpec<TContext>[],
  ancestors: readonly string[],
  prefix: string,
  admin: boolean
): Array<{ usage: string; descriptionKey: string }> => {
  const lines: Array<{ usage: string; descriptionKey: string }> = []
  for (const cmd of commands) {
    if (cmd.permission === 'admin' && !admin) continue
    const name = ancestors.length === 0 ? `${prefix}${cmd.name}` : cmd.name
    const path = [...ancestors, name]
    if (cmd.action) {
      lines.push({ usage: formatUsage(cmd, ancestors, prefix), descriptionKey: cmd.descriptionKey ?? '' })
    }
    if (cmd.subcommands.length > 0) {
      lines.push(...flattenVisible(cmd.subcommands, path, prefix, admin))
    }
  }
  return lines
}

const formatCommandList = <TContext>(
  commands: readonly AnyCommandSpec<TContext>[],
  opts: FormatHelpOptions
) => {
  const { t: translate, prefix = '/', isAdmin: admin = false } = opts
  const title = translate('system.supportedCommands')
  const lines = flattenVisible(commands, [], prefix, admin)
    .map(({ usage, descriptionKey }) => {
      const text = descriptionKey ? translate(descriptionKey) : ''
      return `- ${usage}${text ? `：${text}` : ''}`
    })
  return [title, ...lines].join('\n')
}

const findByPath = <TContext>(
  commands: readonly AnyCommandSpec<TContext>[],
  path: readonly string[],
  prefix = '/'
) => {
  if (path.length === 0) return undefined
  let currentCommands = commands
  let current: AnyCommandSpec<TContext> | undefined
  for (let i = 0; i < path.length; i++) {
    const token = i === 0 ? path[i].replace(new RegExp(`^\\${prefix}`), '') : path[i]
    current = currentCommands.find(cmd => cmd.name === token || cmd.aliases.includes(token))
    if (!current) return undefined
    currentCommands = current.subcommands
  }
  return current
}

const formatDetailedHelp = <TContext>(
  commands: readonly AnyCommandSpec<TContext>[],
  path: readonly string[],
  opts: FormatHelpOptions
) => {
  const { t: translate, prefix = '/', isAdmin: admin = false } = opts

  if (path.length === 0) {
    return formatCommandList(commands, opts)
  }

  const target = findByPath(commands, path, prefix)
  if (!target || (target.permission === 'admin' && !admin)) {
    return `${translate('system.unknownCommand', { token: path.join(' ') })}\n${formatCommandList(commands, opts)}`
  }

  const ancestors = path.slice(0, -1)
  const lines = [`${translate('label.usage')}：${formatUsage(target, ancestors, prefix)}`]
  if (target.descriptionKey) {
    lines.push(`${translate('label.description')}：${translate(target.descriptionKey)}`)
  }
  if (target.aliases.length > 0) {
    lines.push(`${translate('label.aliases')}：${target.aliases.join(', ')}`)
  }
  if (target.args.length > 0) {
    lines.push(`${translate('label.arguments')}：`)
    for (const argument of target.args) {
      lines.push(...formatArgumentHelp(argument, translate))
    }
  }
  const visibleSubs = target.subcommands.filter(s => s.permission !== 'admin' || admin)
  if (visibleSubs.length > 0) {
    lines.push(`${translate('label.subcommands')}：`)
    for (const sub of visibleSubs) {
      const subUsage = formatUsage(sub, [...ancestors, target.name], prefix)
      const subDesc = sub.descriptionKey ? translate(sub.descriptionKey) : ''
      lines.push(`- ${subUsage}${subDesc ? `：${subDesc}` : ''}`)
    }
  }
  return lines.join('\n')
}

// ── Commands ────────────────────────────────────────────────────────────────

export const generalCommands = (
  getPrefix: (ctx: ChannelContext) => string,
  allCommands: () => AnyCommandSpec<ChannelContext>[]
) => [
  command<ChannelContext>('help')
    .description('cmd.help.description')
    .argument(variadicArg('command'))
    .action(async ({ ctx, args: [commandPath] }) => {
      const prefix = getPrefix(ctx)
      const admin = isAdmin(ctx)
      const cmds = allCommands()
      const opts = { t: ctx.t, prefix, isAdmin: admin }
      if ((commandPath as string[]).length === 0) {
        await ctx.reply(formatCommandList(cmds, opts))
      } else {
        await ctx.reply(formatDetailedHelp(cmds, commandPath as string[], opts))
      }
    }),

  command<ChannelContext>('whoami')
    .description('cmd.whoami.description')
    .action(async ({ ctx }) => {
      await ctx.reply([
        ctx.t('whoami.sender', { id: ctx.inbound.senderId ?? '?' }),
        ctx.t('whoami.role', { role: isAdmin(ctx) ? ctx.t('label.admin') : ctx.t('label.user') }),
        ctx.t('whoami.sessionType', {
          type: ctx.inbound.sessionType === 'group' ? ctx.t('label.group') : ctx.t('label.direct')
        }),
        ctx.t('whoami.channelId', { id: ctx.inbound.channelId }),
        ctx.t('whoami.bound', { bound: ctx.sessionId ? ctx.t('label.yes') : ctx.t('label.no') })
      ].join('\n'))
    }),

  command<ChannelContext>('lang')
    .description('cmd.lang.description')
    .adminOnly()
    .argument(requiredArg('language', { choices: LANGUAGE_CHOICES, description: 'cmd.lang.description' }))
    .action(async ({ ctx, args: [target] }) => {
      await updateChannelConfig(ctx, (current) => ({ ...current, language: target }))
      await ctx.reply(ctx.t('cmd.lang.success', { lang: target }))
    })
]
