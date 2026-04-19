import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '#~/db/index.js'
import { sessionsRouter } from '#~/routes/sessions.js'
import { notifySessionUpdated } from '#~/services/session/runtime.js'
import { provisionSessionWorkspace } from '#~/services/session/workspace.js'

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

vi.mock('#~/services/session/create.js', () => ({
  createSessionWithInitialMessage: vi.fn()
}))

vi.mock('#~/services/session/events.js', () => ({
  applySessionEvent: vi.fn()
}))

vi.mock('#~/services/session/history.js', () => ({
  branchSessionFromMessage: vi.fn()
}))

vi.mock('#~/services/session/index.js', () => ({
  killSession: vi.fn(),
  processUserMessage: vi.fn(),
  updateAndNotifySession: vi.fn()
}))

vi.mock('#~/services/session/interaction.js', () => ({
  getSessionInteraction: vi.fn(),
  handleInteractionResponse: vi.fn(),
  setSessionInteraction: vi.fn()
}))

vi.mock('#~/services/session/queue.js', () => ({
  createSessionQueuedMessage: vi.fn(),
  deleteSessionQueuedMessage: vi.fn(),
  listSessionQueuedMessages: vi.fn(() => []),
  moveSessionQueuedMessage: vi.fn(),
  reorderSessionQueuedMessages: vi.fn(),
  updateSessionQueuedMessage: vi.fn()
}))

vi.mock('#~/services/session/runtime.js', () => ({
  broadcastSessionEvent: vi.fn(),
  notifySessionUpdated: vi.fn()
}))

vi.mock('#~/services/session/workspace.js', () => ({
  createSessionManagedWorktree: vi.fn(),
  deleteSessionWorkspace: vi.fn(),
  provisionSessionWorkspace: vi.fn(),
  resolveSessionWorkspace: vi.fn(),
  resolveSessionWorkspaceFolder: vi.fn(),
  transferSessionWorkspaceToLocal: vi.fn()
}))

vi.mock('#~/services/terminal/index.js', () => ({
  disposeTerminalSession: vi.fn()
}))

vi.mock('#~/services/workspace/tree.js', () => ({
  listWorkspaceTree: vi.fn()
}))

const findRouteHandler = (path: string, method: string) => {
  const router = sessionsRouter() as any
  const layer = router.stack.find((item: any) => item.path === path && item.methods.includes(method))
  if (layer == null) {
    throw new Error(`Route ${method} ${path} not found`)
  }
  return layer.stack[0] as (ctx: any) => Promise<void> | void
}

describe('sessionsRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(provisionSessionWorkspace).mockResolvedValue(undefined as any)
  })

  it('preserves the fixed prompt target when forking a session', async () => {
    const originalSession = {
      id: 'session-root',
      title: 'Root',
      promptType: 'workspace',
      promptName: 'client'
    }
    const newSession = {
      id: 'session-fork',
      title: 'Root (Fork)'
    }
    const updatedSession = {
      ...newSession,
      promptType: 'workspace',
      promptName: 'client'
    }
    const db = {
      getSession: vi.fn((id: string) => {
        if (id === originalSession.id) return originalSession
        if (id === newSession.id) return updatedSession
        return undefined
      }),
      createSession: vi.fn(() => newSession),
      updateSession: vi.fn(),
      copyMessages: vi.fn(),
      deleteSession: vi.fn()
    }
    vi.mocked(getDb).mockReturnValue(db as any)

    const handleFork = findRouteHandler('/:id/fork', 'POST')
    const ctx = {
      params: { id: originalSession.id },
      request: { body: {} },
      body: undefined
    }

    await handleFork(ctx)

    expect(db.createSession).toHaveBeenCalledWith('Root (Fork)')
    expect(db.updateSession).toHaveBeenCalledWith(newSession.id, {
      promptType: 'workspace',
      promptName: 'client'
    })
    expect(provisionSessionWorkspace).toHaveBeenCalledWith(newSession.id, {
      sourceSessionId: originalSession.id
    })
    expect(db.copyMessages).toHaveBeenCalledWith(originalSession.id, newSession.id)
    expect(notifySessionUpdated).toHaveBeenCalledWith(newSession.id, updatedSession)
    expect(ctx.body).toEqual({ session: updatedSession })
  })
})
