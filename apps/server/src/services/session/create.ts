import type { ChatMessageContent, Session } from '@vibe-forge/core'
import type { GitBranchKind, SessionPromptType } from '@vibe-forge/types'

import { getDb } from '#~/db/index.js'
import { getWorkspaceFolder, loadConfigState } from '#~/services/config/index.js'
import { checkoutSessionGitBranch, createSessionGitBranch } from '#~/services/git/index.js'
import { processUserMessage, startAdapterSession } from '#~/services/session/index.js'
import { notifySessionUpdated } from '#~/services/session/runtime.js'
import {
  deleteSessionWorkspace,
  provisionSessionWorkspace,
  resolveSessionWorkspace
} from '#~/services/session/workspace.js'

interface CreateSessionWorkspaceBranchOptions {
  name: string
  kind?: GitBranchKind
  mode?: 'checkout' | 'create'
}

interface CreateSessionWorkspaceOptions {
  createWorktree?: boolean
  worktreeEnvironment?: string
  branch?: CreateSessionWorkspaceBranchOptions
}

const resolveCreateSessionConfigWorkspaceFolder = async (parentSessionId?: string) => {
  if (parentSessionId != null && parentSessionId !== '') {
    const workspace = await resolveSessionWorkspace(parentSessionId)
    return workspace.workspaceFolder
  }

  return getWorkspaceFolder()
}

const resolveCreateSessionWorktreeDefault = async (
  parentSessionId?: string,
  workspace?: CreateSessionWorkspaceOptions
) => {
  if (workspace?.createWorktree != null) {
    return workspace.createWorktree
  }

  const workspaceFolder = await resolveCreateSessionConfigWorkspaceFolder(parentSessionId)
  const { mergedConfig } = await loadConfigState(workspaceFolder)
    .catch(() => ({ mergedConfig: {} as { conversation?: { createSessionWorktree?: boolean } } }))

  return mergedConfig.conversation?.createSessionWorktree ?? true
}

export async function createSessionWithInitialMessage(options: {
  title?: string
  initialMessage?: string
  initialContent?: ChatMessageContent[]
  parentSessionId?: string
  id?: string
  shouldStart?: boolean
  beforeStart?: (sessionId: string) => void | Promise<void>
  tags?: string[]
  model?: string
  effort?: 'low' | 'medium' | 'high' | 'max'
  promptType?: SessionPromptType
  promptName?: string
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions'
  systemPrompt?: string
  adapter?: string
  account?: string
  workspace?: CreateSessionWorkspaceOptions
}): Promise<Session> {
  const {
    title,
    initialMessage,
    initialContent,
    parentSessionId,
    id,
    shouldStart = true,
    beforeStart,
    tags,
    model,
    effort,
    promptType,
    promptName,
    permissionMode,
    systemPrompt,
    adapter,
    account,
    workspace
  } = options
  const db = getDb()
  const session = db.createSession(title, id, undefined, parentSessionId)
  if (
    model !== undefined ||
    effort !== undefined ||
    permissionMode !== undefined ||
    adapter !== undefined ||
    account !== undefined ||
    promptType !== undefined ||
    promptName !== undefined
  ) {
    db.updateSession(session.id, { model, effort, permissionMode, adapter, account, promptType, promptName })
    const updatedSession = db.getSession(session.id)
    if (updatedSession) {
      Object.assign(session, updatedSession)
    }
  }

  if (tags && tags.length > 0) {
    db.updateSessionTags(session.id, tags)
    const updated = db.getSession(session.id)
    if (updated) {
      Object.assign(session, updated)
    }
  }

  try {
    const createWorktree = await resolveCreateSessionWorktreeDefault(parentSessionId, workspace)
    await provisionSessionWorkspace(session.id, {
      sourceSessionId: parentSessionId,
      createWorktree,
      worktreeEnvironment: workspace?.worktreeEnvironment
    })

    if (workspace?.branch != null) {
      const branchName = workspace.branch.name.trim()
      if (branchName !== '') {
        if (workspace.branch.mode === 'create') {
          await createSessionGitBranch(session.id, branchName)
        } else {
          await checkoutSessionGitBranch(session.id, {
            name: branchName,
            kind: workspace.branch.kind ?? 'local'
          })
        }
      }
    }
  } catch (err) {
    await deleteSessionWorkspace(session.id, { force: true }).catch(() => undefined)
    db.deleteSession(session.id)
    throw err
  }

  notifySessionUpdated(session.id, session)

  if ((initialMessage || initialContent) && shouldStart) {
    try {
      await beforeStart?.(session.id)
      await startAdapterSession(
        session.id,
        { model, effort, promptType, promptName, permissionMode, systemPrompt, adapter, account }
      )
      if (initialContent) {
        processUserMessage(session.id, initialContent)
      } else if (initialMessage) {
        processUserMessage(session.id, initialMessage)
      }

      const updated = db.getSession(session.id)
      if (updated) {
        Object.assign(session, updated)
      }
    } catch (err) {
      console.error(`[sessions] Failed to start session ${session.id}:`, err)
      await deleteSessionWorkspace(session.id, { force: true }).catch(() => undefined)
      db.deleteSession(session.id)
      throw err
    }
  }

  return session
}
