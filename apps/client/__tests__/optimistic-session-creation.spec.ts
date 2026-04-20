import { describe, expect, it } from 'vitest'

import type { Session } from '@vibe-forge/core'

import {
  clearOptimisticSessionDiscarded,
  createOptimisticSessionCreation,
  isOptimisticSessionDiscarded,
  markOptimisticSessionCreationFailed,
  markOptimisticSessionDiscarded,
  mergeOptimisticSessions
} from '#~/hooks/chat/optimistic-session-creation'

describe('optimistic session creation', () => {
  it('creates a temporary session and initial user message from the first send', () => {
    const creation = createOptimisticSessionCreation({
      id: 'session-1',
      initialMessage: 'Build an optimistic session flow',
      model: 'test-model',
      options: {
        id: 'session-1',
        adapter: 'codex',
        permissionMode: 'acceptEdits'
      }
    }, 123)

    expect(creation.status).toBe('creating')
    expect(creation.message).toMatchObject({
      id: 'session-1:optimistic-user-message',
      role: 'user',
      content: 'Build an optimistic session flow',
      createdAt: 123
    })
    expect(creation.session).toMatchObject({
      id: 'session-1',
      title: 'Build an optimistic session flow',
      status: 'running',
      lastUserMessage: 'Build an optimistic session flow',
      model: 'test-model',
      adapter: 'codex',
      permissionMode: 'acceptEdits'
    })
  })

  it('lets optimistic state override stale SWR sessions while creation is unresolved', () => {
    const staleSession: Session = {
      id: 'session-1',
      title: 'Still running',
      createdAt: 100,
      status: 'running'
    }
    const creation = markOptimisticSessionCreationFailed(
      createOptimisticSessionCreation({
        id: 'session-1',
        initialMessage: 'Retry me',
        options: { id: 'session-1' }
      }, 101),
      'Worktree failed'
    )

    expect(mergeOptimisticSessions([staleSession], { 'session-1': creation })).toEqual([
      creation.session
    ])
  })

  it('tracks discarded optimistic session ids outside React component lifetime', () => {
    clearOptimisticSessionDiscarded('session-1')
    expect(isOptimisticSessionDiscarded('session-1')).toBe(false)

    markOptimisticSessionDiscarded('session-1')
    expect(isOptimisticSessionDiscarded('session-1')).toBe(true)

    clearOptimisticSessionDiscarded('session-1')
    expect(isOptimisticSessionDiscarded('session-1')).toBe(false)
  })
})
