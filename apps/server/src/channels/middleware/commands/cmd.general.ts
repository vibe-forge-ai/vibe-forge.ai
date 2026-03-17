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
  'help.page': ({ current, total }) => `第 ${current}/${total} 页`,
  'help.search.title': ({ query }) => `未找到完整匹配，以下是与“${query}”相关的指令：`,
  'help.search.empty': ({ query }) => `未找到与“${query}”相关的指令。`,
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
  'help.page': ({ current, total }) => `Page ${current}/${total}`,
  'help.search.title': ({ query }) => `No exact match found. Commands related to "${query}":`,
  'help.search.empty': ({ query }) => `No commands related to "${query}" were found.`,
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

interface HelpListEntry {
  usage: string
  descriptionKey: string
  path: string[]
  aliases: string[]
}

interface HelpRequest {
  page: number
  query: string
  path: string[]
}

interface HelpPage {
  text: string
  followUps: Array<{ content: string }>
}

const HELP_PAGE_SIZE = 8

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
): HelpListEntry[] => {
  const lines: HelpListEntry[] = []
  for (const cmd of commands) {
    if (cmd.permission === 'admin' && !admin) continue
    const name = ancestors.length === 0 ? `${prefix}${cmd.name}` : cmd.name
    const path = [...ancestors, name]
    if (cmd.action) {
      lines.push({
        usage: formatUsage(cmd, ancestors, prefix),
        descriptionKey: cmd.descriptionKey ?? '',
        path: [cmd.name],
        aliases: [...cmd.aliases]
      })
    }
    if (cmd.subcommands.length > 0) {
      const childEntries = flattenVisible(cmd.subcommands, path, prefix, admin)
      lines.push(...childEntries.map(entry => ({
        ...entry,
        path: [cmd.name, ...entry.path]
      })))
    }
  }
  return lines
}

const normalizeHelpText = (value: string) => value.trim().toLowerCase()

const findSubsequenceIndex = (haystack: string, needle: string) => {
  if (needle === '') return 0
  let needleIndex = 0
  let firstMatchIndex = -1
  for (let haystackIndex = 0; haystackIndex < haystack.length; haystackIndex += 1) {
    if (haystack[haystackIndex] !== needle[needleIndex]) continue
    if (firstMatchIndex === -1) firstMatchIndex = haystackIndex
    needleIndex += 1
    if (needleIndex === needle.length) {
      return firstMatchIndex
    }
  }
  return -1
}

const scoreSearchCandidate = (query: string, candidate: string) => {
  const normalizedQuery = normalizeHelpText(query)
  const normalizedCandidate = normalizeHelpText(candidate)
  if (normalizedQuery === '' || normalizedCandidate === '') return -1
  if (normalizedCandidate === normalizedQuery) return 1000
  if (normalizedCandidate.startsWith(normalizedQuery)) {
    return 800 - (normalizedCandidate.length - normalizedQuery.length)
  }
  const includeIndex = normalizedCandidate.indexOf(normalizedQuery)
  if (includeIndex >= 0) return 600 - includeIndex
  const subsequenceIndex = findSubsequenceIndex(normalizedCandidate, normalizedQuery)
  if (subsequenceIndex >= 0) return 300 - subsequenceIndex
  return -1
}

const searchVisibleCommands = (entries: readonly HelpListEntry[], query: string) => {
  return entries
    .map((entry) => {
      const pathCandidate = entry.path.join(' ')
      const aliasCandidates = entry.aliases.map(alias => `${entry.path.slice(0, -1).join(' ')} ${alias}`.trim())
      const usageCandidate = entry.usage.replace(/^\//, '')
      const score = Math.max(
        scoreSearchCandidate(query, pathCandidate),
        scoreSearchCandidate(query, usageCandidate),
        ...aliasCandidates.map(candidate => scoreSearchCandidate(query, candidate))
      )
      return { entry, score }
    })
    .filter(result => result.score >= 0)
    .sort((left, right) => right.score - left.score || left.entry.usage.localeCompare(right.entry.usage))
    .map(result => result.entry)
}

const parseHelpRequest = (rawArgs: readonly string[]): HelpRequest => {
  let page = 1
  let query = ''
  const path: string[] = []

  for (const token of rawArgs) {
    if (token.startsWith('--page=')) {
      const parsedPage = Number.parseInt(token.slice('--page='.length), 10)
      if (Number.isFinite(parsedPage) && parsedPage > 0) {
        page = parsedPage
      }
      continue
    }
    if (token.startsWith('--query=')) {
      query = decodeURIComponent(token.slice('--query='.length))
      continue
    }
    path.push(token)
  }

  if (query === '') {
    query = path.join(' ').trim()
  }

  return { page, query, path }
}

const formatHelpEntries = (
  entries: readonly HelpListEntry[],
  translate: (key: string, args?: Record<string, string | number | boolean | undefined>) => string
) =>
  entries.map(({ usage, descriptionKey }) => {
    const text = descriptionKey ? translate(descriptionKey) : ''
    return `- ${usage}${text ? `：${text}` : ''}`
  })

const createHelpPageCommand = (prefix: string, page: number, query: string) => {
  const parts = [`${prefix}help`, `--page=${page}`]
  if (query !== '') {
    parts.push(`--query=${encodeURIComponent(query)}`)
  }
  return parts.join(' ')
}

const paginateHelpEntries = (
  entries: readonly HelpListEntry[],
  title: string,
  opts: FormatHelpOptions,
  query = '',
  requestedPage = 1
): HelpPage => {
  const { t: translate, prefix = '/' } = opts
  const totalPages = Math.max(1, Math.ceil(entries.length / HELP_PAGE_SIZE))
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages)
  const startIndex = (currentPage - 1) * HELP_PAGE_SIZE
  const currentEntries = entries.slice(startIndex, startIndex + HELP_PAGE_SIZE)
  const lines = [
    title,
    translate('help.page', { current: currentPage, total: totalPages }),
    ...formatHelpEntries(currentEntries, translate)
  ]

  const followUps = [] as Array<{ content: string }>
  if (totalPages > 1 && currentPage > 1) {
    followUps.push({ content: createHelpPageCommand(prefix, currentPage - 1, query) })
  }
  if (totalPages > 1 && currentPage < totalPages) {
    followUps.push({ content: createHelpPageCommand(prefix, currentPage + 1, query) })
  }

  return {
    text: lines.join('\n'),
    followUps
  }
}

const formatCommandList = <TContext>(
  commands: readonly AnyCommandSpec<TContext>[],
  opts: FormatHelpOptions,
  page = 1
) => {
  const { t: translate, prefix = '/', isAdmin: admin = false } = opts
  const title = translate('system.supportedCommands')
  const lines = flattenVisible(commands, [], prefix, admin)
  return paginateHelpEntries(lines, title, opts, '', page)
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
    return formatCommandList(commands, opts).text
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

const formatSearchHelp = <TContext>(
  commands: readonly AnyCommandSpec<TContext>[],
  query: string,
  opts: FormatHelpOptions,
  page = 1
) => {
  const { t: translate, prefix = '/', isAdmin: admin = false } = opts
  const entries = flattenVisible(commands, [], prefix, admin)
  const matches = searchVisibleCommands(entries, query)
  if (matches.length === 0) {
    return {
      text: translate('help.search.empty', { query }),
      followUps: []
    }
  }
  return paginateHelpEntries(matches, translate('help.search.title', { query }), opts, query, page)
}

const canUseFollowUps = (ctx: ChannelContext) =>
  ctx.inbound.channelType === 'lark' && ctx.inbound.sessionType === 'direct'

// ── Commands ────────────────────────────────────────────────────────────────

export const generalCommands = (
  getPrefix: (ctx: ChannelContext) => string,
  allCommands: () => AnyCommandSpec<ChannelContext>[]
) => [
  command<ChannelContext>('help')
    .description('cmd.help.description')
    .argument(variadicArg('command'))
    .action(async ({ ctx, rawArgs }) => {
      const prefix = getPrefix(ctx)
      const admin = isAdmin(ctx)
      const cmds = allCommands()
      const opts = { t: ctx.t, prefix, isAdmin: admin }
      const helpRequest = parseHelpRequest(rawArgs)

      if (helpRequest.path.length === 0 && helpRequest.query === '') {
        const helpPage = formatCommandList(cmds, opts, helpRequest.page)
        const result = await ctx.reply(helpPage.text)
        if (canUseFollowUps(ctx)) {
          await ctx.pushFollowUps({ messageId: result?.messageId, followUps: helpPage.followUps })
        }
        return
      }

      const exactHelp = formatDetailedHelp(cmds, helpRequest.path, opts)
      const target = findByPath(cmds, helpRequest.path, prefix)
      if (target && (target.permission !== 'admin' || admin)) {
        await ctx.reply(exactHelp)
        return
      }

      const helpPage = formatSearchHelp(cmds, helpRequest.query, opts, helpRequest.page)
      const result = await ctx.reply(helpPage.text)
      if (canUseFollowUps(ctx)) {
        await ctx.pushFollowUps({ messageId: result?.messageId, followUps: helpPage.followUps })
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
