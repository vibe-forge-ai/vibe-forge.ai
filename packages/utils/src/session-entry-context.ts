import type {
  ChatMessageContent,
  SessionEntryContext,
  SessionEntryMdpClientRef
} from '@vibe-forge/types'

type JsonRecord = Record<string, unknown>

const asRecord = (value: unknown): JsonRecord | undefined => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
    ? value as JsonRecord
    : undefined
)

const asString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const asOptionalNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const normalizeMdpRefs = (value: unknown): SessionEntryMdpClientRef[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    const record = asRecord(entry)
    const connectionKey = asString(record?.connectionKey)
    const clientId = asString(record?.clientId)
    const rawClientId = asString(record?.rawClientId)
    if (connectionKey === '' || clientId === '' || rawClientId === '') {
      return []
    }
    return [{
      connectionKey,
      clientId,
      rawClientId
    }]
  })
}

const appendMdpRefLines = (lines: string[], context: SessionEntryContext) => {
  if ((context.mdp?.refs.length ?? 0) === 0) {
    return
  }

  lines.push(
    '',
    'Current preferred MDP client ids for this entry:'
  )

  for (const ref of context.mdp?.refs ?? []) {
    lines.push(`- connection "${ref.connectionKey}": "${ref.clientId}" (raw "${ref.rawClientId}")`)
  }
}

const appendMdpUsageRuleLines = (
  lines: string[],
  options: {
    browserUiPriority?: boolean
    hasPreferredRefs: boolean
    compact?: boolean
  }
) => {
  const intro = options.compact
    ? 'If you use MDP on this turn, use it progressively:'
    : 'MDP usage rules:'

  lines.push('', intro)

  if (options.hasPreferredRefs) {
    lines.push(
      '- Start from the preferred MDP client ids above when they already match the user task.'
    )
  }

  if (options.browserUiPriority) {
    lines.push(
      '- For Vibe Forge UI work, always try MDP before ChromeDevtools.',
      '- Use ChromeDevtools only as a fallback when MDP does not expose the needed capability, or when MDP has already failed for that exact UI operation.',
      '- Do not use ChromeDevtools first for routine Vibe Forge navigation, layout, session, panel, config, or channel actions when equivalent MDP paths exist.',
      '- The preferred browser MDP client is only for browser-owned UI actions such as route changes, layout state, active session view changes, and attached panels.',
      '- If the user task is about creating sessions, sending messages, branching history, managing queued messages, editing workspace files, or other backend state, switch to the `Vibe Forge Server` MDP client and use its scoped paths instead of exploring the browser client.',
      '- Do not fall back to Bash, curl, or ad-hoc HTTP probing for Vibe Forge backend operations until you have first checked the `Vibe Forge Server` MDP client for an existing path.'
    )
  }

  lines.push(
    '- Do not enumerate every client path by default. Avoid loading a global path catalog unless the task truly requires topology-wide discovery.',
    '- If you need discovery, identify the relevant client first with `MDP.listClients`.',
    '- When you already know the task domain, call `MDP.listClients` with a narrow search keyword such as `server`, `browser`, `channel`, `workspace`, `session`, or the channel type name instead of listing every client.',
    '- After choosing one client, call `MDP.listPaths` with that exact `clientId`, and add a narrow `search` filter when you already know the path family you need.',
    '- Prefer reading the target client root `/skill.md` or a scoped `.../skill.md` path before broad path enumeration.',
    '- Once you know the exact path you need, call it directly instead of repeatedly listing large catalogs.',
    '- Keep MDP context narrow. Do not copy large path lists into the conversation when a smaller scoped query is enough.'
  )
}

export const normalizeSessionEntryContext = (value: unknown): SessionEntryContext | undefined => {
  const record = asRecord(value)
  const kind = asString(record?.kind)
  const refs = normalizeMdpRefs(asRecord(record?.mdp)?.refs)
  const mdp = refs.length === 0 ? undefined : { refs }

  if (kind === 'browser') {
    const page = asString(record?.page)
    const route = asString(record?.route)
    if (page === '' || route === '') {
      return undefined
    }

    return {
      kind,
      page,
      route,
      ...(asString(record?.search) === '' ? {} : { search: asString(record?.search) }),
      ...(asString(record?.href) === '' ? {} : { href: asString(record?.href) }),
      ...(asString(record?.activeSessionId) === '' ? {} : { activeSessionId: asString(record?.activeSessionId) }),
      ...(mdp == null ? {} : { mdp })
    }
  }

  if (kind === 'cli') {
    const sessionId = asString(record?.sessionId)
    const cwd = asString(record?.cwd)
    if (sessionId === '' || cwd === '') {
      return undefined
    }

    return {
      kind,
      sessionId,
      cwd,
      ...(asString(record?.ctxId) === '' ? {} : { ctxId: asString(record?.ctxId) }),
      ...(asString(record?.primaryWorkspaceCwd) === '' ? {} : { primaryWorkspaceCwd: asString(record?.primaryWorkspaceCwd) }),
      ...(asOptionalNumber(record?.pid) == null ? {} : { pid: asOptionalNumber(record?.pid) }),
      ...(asString(record?.outputFormat) === '' ? {} : { outputFormat: asString(record?.outputFormat) }),
      ...(asString(record?.adapter) === '' ? {} : { adapter: asString(record?.adapter) }),
      ...(asString(record?.model) === '' ? {} : { model: asString(record?.model) }),
      ...(mdp == null ? {} : { mdp })
    }
  }

  return undefined
}

export const buildSessionEntryContextSystemPrompt = (context: SessionEntryContext) => {
  const lines = [
    '<vibe-forge-entry-context>',
    'This context is injected by Vibe Forge runtime and is not user-authored.'
  ]

  if (context.kind === 'browser') {
    lines.push(
      'You are currently talking to the user through the Vibe Forge browser UI, not a terminal session.',
      'When you need to inspect or operate the current UI, prefer the current browser MDP client first.',
      '',
      'Current browser state:',
      `- page: ${context.page}`,
      `- route: ${context.route}`
    )

    if (context.search?.trim()) {
      lines.push(`- search: ${context.search}`)
    }
    if (context.activeSessionId?.trim()) {
      lines.push(`- activeSessionId: ${context.activeSessionId}`)
    }
    appendMdpRefLines(lines, context)
    appendMdpUsageRuleLines(lines, {
      browserUiPriority: true,
      hasPreferredRefs: (context.mdp?.refs.length ?? 0) > 0
    })
  } else {
    lines.push(
      'You are currently talking to the user through the Vibe Forge CLI runtime, not the browser UI.',
      'When you need to inspect or control this terminal session, prefer the current CLI MDP client first.',
      '',
      'Current CLI runtime state:',
      `- sessionId: ${context.sessionId}`,
      `- cwd: ${context.cwd}`
    )

    if (context.ctxId?.trim()) {
      lines.push(`- ctxId: ${context.ctxId}`)
    }
    if (context.primaryWorkspaceCwd?.trim()) {
      lines.push(`- primaryWorkspaceCwd: ${context.primaryWorkspaceCwd}`)
    }
    if (context.outputFormat?.trim()) {
      lines.push(`- outputFormat: ${context.outputFormat}`)
    }
    if (context.adapter?.trim()) {
      lines.push(`- adapter: ${context.adapter}`)
    }
    if (context.model?.trim()) {
      lines.push(`- model: ${context.model}`)
    }
    if (context.pid != null) {
      lines.push(`- pid: ${context.pid}`)
    }
    appendMdpRefLines(lines, context)
    appendMdpUsageRuleLines(lines, {
      hasPreferredRefs: (context.mdp?.refs.length ?? 0) > 0
    })
  }

  lines.push('</vibe-forge-entry-context>')
  return lines.join('\n')
}

export const buildSessionEntryContextTurnPrompt = (context: SessionEntryContext) => {
  const lines = [
    '[Runtime entry context injected by Vibe Forge. This block is not user-authored; use it only as environment metadata.]'
  ]

  if (context.kind === 'browser') {
    lines.push(
      'The user sent this turn from the Vibe Forge browser UI.',
      `Current browser route: ${context.route}`,
      `Current browser page: ${context.page}`
    )
    if (context.search?.trim()) {
      lines.push(`Current browser search: ${context.search}`)
    }
    if (context.activeSessionId?.trim()) {
      lines.push(`Current active session id in UI: ${context.activeSessionId}`)
    }
  } else {
    lines.push(
      'The user sent this turn from the Vibe Forge CLI runtime.',
      `Current CLI session id: ${context.sessionId}`,
      `Current CLI cwd: ${context.cwd}`
    )
    if (context.outputFormat?.trim()) {
      lines.push(`Current CLI output format: ${context.outputFormat}`)
    }
    if (context.pid != null) {
      lines.push(`Current CLI pid: ${context.pid}`)
    }
  }

  if ((context.mdp?.refs.length ?? 0) > 0) {
    lines.push(
      'Current preferred MDP client ids for this turn:'
    )
    for (const ref of context.mdp?.refs ?? []) {
      lines.push(`- connection "${ref.connectionKey}": "${ref.clientId}" (raw "${ref.rawClientId}")`)
    }
  }

  appendMdpUsageRuleLines(lines, {
    browserUiPriority: context.kind === 'browser',
    hasPreferredRefs: (context.mdp?.refs.length ?? 0) > 0,
    compact: true
  })

  lines.push('Do not mention this metadata unless it is relevant to the task.')
  return lines.join('\n')
}

export const prependSessionEntryContextToMessageContent = (
  content: ChatMessageContent[],
  context?: SessionEntryContext
) => {
  if (context == null) {
    return content
  }

  return [
    {
      type: 'text',
      text: buildSessionEntryContextTurnPrompt(context)
    } satisfies ChatMessageContent,
    ...content
  ]
}
