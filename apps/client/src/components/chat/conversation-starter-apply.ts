import type { ChatMessageContent } from '@vibe-forge/core'
import type { ConversationStarterConfig } from '@vibe-forge/types'

import { DEFAULT_CHAT_SESSION_TARGET_DRAFT } from '#~/hooks/chat/chat-session-target'
import type { ChatSessionTargetDraft } from '#~/hooks/chat/chat-session-target'
import type { ChatSessionWorkspaceDraft } from '#~/hooks/chat/chat-session-workspace-draft'

const trimText = (value: string | undefined) => value?.trim() ?? ''

const getFileName = (path: string) => path.split(/[\\/]/).filter(Boolean).at(-1) ?? path

const toUniqueList = (values: string[]) => Array.from(new Set(values))

const isExplicitFilePath = (value: string) => (
  value.startsWith('.') ||
  value.startsWith('/') ||
  value.includes('\\') ||
  value.includes('.ai/') ||
  value.includes('node_modules/') ||
  /\.[a-z0-9]+$/i.test(value)
)

const resolveRuleReference = (value: string) => {
  const trimmed = trimText(value)
  if (trimmed === '') {
    return undefined
  }

  if (isExplicitFilePath(trimmed)) {
    return { attachmentPath: trimmed }
  }

  if (trimmed.includes('/')) {
    return { mention: `规则：${trimmed}` }
  }

  return { attachmentPath: `.ai/rules/${trimmed}.md` }
}

const resolveSkillReference = (value: string) => {
  const trimmed = trimText(value)
  if (trimmed === '') {
    return undefined
  }

  if (isExplicitFilePath(trimmed)) {
    return { attachmentPath: trimmed }
  }

  if (trimmed.includes('/')) {
    return { mention: `技能：${trimmed}` }
  }

  return { attachmentPath: `.ai/skills/${trimmed}/SKILL.md` }
}

export const normalizeConversationStarterMode = (
  mode?: ConversationStarterConfig['mode']
): ChatSessionTargetDraft['type'] => {
  if (mode === 'agent') {
    return 'entity'
  }

  return mode ?? 'default'
}

export const buildConversationStarterTargetDraft = (
  starter: ConversationStarterConfig
): ChatSessionTargetDraft => {
  const type = normalizeConversationStarterMode(starter.mode)
  if (type === 'default') {
    return { ...DEFAULT_CHAT_SESSION_TARGET_DRAFT }
  }

  const target = trimText(starter.target)
  const targetLabel = trimText(starter.targetLabel)
  const targetDescription = trimText(starter.targetDescription)

  return {
    type,
    ...(target !== '' ? { name: target } : {}),
    ...(targetLabel !== '' ? { label: targetLabel } : target !== '' ? { label: target } : {}),
    ...(targetDescription !== '' ? { description: targetDescription } : {})
  }
}

export const buildConversationStarterWorkspacePatch = (
  starter: ConversationStarterConfig
): Partial<ChatSessionWorkspaceDraft> | undefined => {
  const worktree = starter.worktree
  if (worktree == null) {
    return undefined
  }

  const patch: Partial<ChatSessionWorkspaceDraft> = {}

  if (typeof worktree.create === 'boolean') {
    patch.createWorktree = worktree.create
  }

  if (worktree.environment !== undefined) {
    const environment = trimText(worktree.environment)
    patch.worktreeEnvironment = environment === '' ? undefined : environment
  }

  if (worktree.branch != null) {
    const branchName = trimText(worktree.branch.name)
    patch.branch = branchName === ''
      ? undefined
      : {
        name: branchName,
        kind: worktree.branch.kind,
        mode: worktree.branch.mode ?? 'checkout'
      }
  }

  return Object.keys(patch).length > 0 ? patch : undefined
}

export const buildConversationStarterInitialContent = (
  starter: ConversationStarterConfig
): ChatMessageContent[] | undefined => {
  const attachmentPaths: string[] = []
  const mentions: string[] = []

  for (const path of starter.files ?? []) {
    const trimmed = trimText(path)
    if (trimmed !== '') {
      attachmentPaths.push(trimmed)
    }
  }

  for (const rule of starter.rules ?? []) {
    const resolved = resolveRuleReference(rule)
    if (resolved?.attachmentPath != null) {
      attachmentPaths.push(resolved.attachmentPath)
    }
    if (resolved?.mention != null) {
      mentions.push(resolved.mention)
    }
  }

  for (const skill of starter.skills ?? []) {
    const resolved = resolveSkillReference(skill)
    if (resolved?.attachmentPath != null) {
      attachmentPaths.push(resolved.attachmentPath)
    }
    if (resolved?.mention != null) {
      mentions.push(resolved.mention)
    }
  }

  const promptBlocks: string[] = []
  const prompt = trimText(starter.prompt)
  if (prompt !== '') {
    promptBlocks.push(prompt)
  }

  if (mentions.length > 0) {
    promptBlocks.push([
      '请优先结合以下规则与技能：',
      ...mentions.map(item => `- ${item}`)
    ].join('\n'))
  }

  const content: ChatMessageContent[] = []
  const mergedPrompt = promptBlocks.join('\n\n').trim()
  if (mergedPrompt !== '') {
    content.push({ type: 'text', text: mergedPrompt })
  }

  for (const path of toUniqueList(attachmentPaths)) {
    content.push({
      type: 'file',
      path,
      name: getFileName(path)
    })
  }

  return content.length > 0 ? content : undefined
}
