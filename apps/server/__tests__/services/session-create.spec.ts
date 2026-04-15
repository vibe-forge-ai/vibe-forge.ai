import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '#~/db/index.js'
import { createSessionWithInitialMessage } from '#~/services/session/create.js'

const mocks = vi.hoisted(() => ({
  getWorkspaceFolder: vi.fn(),
  loadConfigState: vi.fn(),
  checkoutSessionGitBranch: vi.fn(),
  createSessionGitBranch: vi.fn(),
  processUserMessage: vi.fn(),
  startAdapterSession: vi.fn(),
  notifySessionUpdated: vi.fn(),
  deleteSessionWorkspace: vi.fn(),
  provisionSessionWorkspace: vi.fn(),
  resolveSessionWorkspace: vi.fn()
}))

vi.mock('#~/db/index.js', () => ({
  getDb: vi.fn()
}))

vi.mock('#~/services/config/index.js', () => ({
  getWorkspaceFolder: mocks.getWorkspaceFolder,
  loadConfigState: mocks.loadConfigState
}))

vi.mock('#~/services/git/index.js', () => ({
  checkoutSessionGitBranch: mocks.checkoutSessionGitBranch,
  createSessionGitBranch: mocks.createSessionGitBranch
}))

vi.mock('#~/services/session/index.js', () => ({
  processUserMessage: mocks.processUserMessage,
  startAdapterSession: mocks.startAdapterSession
}))

vi.mock('#~/services/session/runtime.js', () => ({
  notifySessionUpdated: mocks.notifySessionUpdated
}))

vi.mock('#~/services/session/workspace.js', () => ({
  deleteSessionWorkspace: mocks.deleteSessionWorkspace,
  provisionSessionWorkspace: mocks.provisionSessionWorkspace,
  resolveSessionWorkspace: mocks.resolveSessionWorkspace
}))

describe('createSessionWithInitialMessage', () => {
  const createSession = vi.fn()
  const updateSession = vi.fn()
  const getSession = vi.fn()
  const updateSessionTags = vi.fn()
  const deleteSession = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    createSession.mockImplementation((title?: string, id?: string) => ({
      id: id ?? 'sess-1',
      title,
      createdAt: Date.now()
    }))
    getSession.mockImplementation((id: string) => ({
      id,
      createdAt: Date.now()
    }))
    vi.mocked(getDb).mockReturnValue({
      createSession,
      updateSession,
      getSession,
      updateSessionTags,
      deleteSession
    } as any)

    mocks.getWorkspaceFolder.mockReturnValue('/workspace/root')
    mocks.loadConfigState.mockResolvedValue({
      workspaceFolder: '/workspace/root',
      projectConfig: {},
      userConfig: {},
      mergedConfig: {}
    })
    mocks.provisionSessionWorkspace.mockResolvedValue({
      sessionId: 'sess-1',
      workspaceFolder: '/workspace/root'
    })
    mocks.deleteSessionWorkspace.mockResolvedValue(true)
    mocks.resolveSessionWorkspace.mockResolvedValue({
      sessionId: 'parent-1',
      workspaceFolder: '/workspace/root'
    })
  })

  it('uses the project config default when createWorktree is not provided', async () => {
    mocks.loadConfigState.mockResolvedValueOnce({
      workspaceFolder: '/workspace/root',
      projectConfig: {},
      userConfig: {},
      mergedConfig: {
        conversation: {
          createSessionWorktree: false
        }
      }
    })

    await createSessionWithInitialMessage({
      title: 'Demo',
      shouldStart: false
    })

    expect(mocks.provisionSessionWorkspace).toHaveBeenCalledWith('sess-1', {
      sourceSessionId: undefined,
      createWorktree: false
    })
  })

  it('prefers the explicit workspace option over the project config default', async () => {
    mocks.loadConfigState.mockResolvedValueOnce({
      workspaceFolder: '/workspace/root',
      projectConfig: {},
      userConfig: {},
      mergedConfig: {
        conversation: {
          createSessionWorktree: false
        }
      }
    })

    await createSessionWithInitialMessage({
      title: 'Demo',
      shouldStart: false,
      workspace: {
        createWorktree: true
      }
    })

    expect(mocks.provisionSessionWorkspace).toHaveBeenCalledWith('sess-1', {
      sourceSessionId: undefined,
      createWorktree: true
    })
  })
})
