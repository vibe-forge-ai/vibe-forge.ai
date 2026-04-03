import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatMessageContent, WSEvent } from '@vibe-forge/core'

import { SqliteDb, getDb } from '#~/db/index.js'
import { createSqliteDatabase } from '#~/db/sqlite.js'
import { branchSessionFromMessage } from '#~/services/session/history.js'
import { notifySessionUpdated } from '#~/services/session/runtime.js'

vi.mock('#~/db/index.js', async () => {
  const actual = await vi.importActual<typeof import('#~/db/index.js')>('#~/db/index.js')
  return {
    ...actual,
    getDb: vi.fn()
  }
})

vi.mock('#~/services/session/runtime.js', async () => {
  const actual = await vi.importActual<typeof import('#~/services/session/runtime.js')>('#~/services/session/runtime.js')
  return {
    ...actual,
    notifySessionUpdated: vi.fn()
  }
})

describe('session history branching', () => {
  let db: SqliteDb

  beforeEach(() => {
    const sqlite = createSqliteDatabase(':memory:')
    db = new SqliteDb({ db: sqlite })
    vi.mocked(getDb).mockReturnValue(db)
  })

  afterEach(() => {
    db.close()
    vi.clearAllMocks()
  })

  it('creates an edited child session from a user message', () => {
    const original = db.createSession('Original', 'session-root', 'completed')
    db.updateSession(original.id, {
      model: 'gpt-4o',
      adapter: 'codex',
      permissionMode: 'default',
      effort: 'medium'
    })

    const events: WSEvent[] = [
      {
        type: 'message',
        message: {
          id: 'user-1',
          role: 'user',
          content: 'first prompt',
          createdAt: 1
        }
      },
      {
        type: 'message',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          content: 'first answer',
          createdAt: 2
        }
      },
      {
        type: 'message',
        message: {
          id: 'user-2',
          role: 'user',
          content: 'second prompt',
          createdAt: 3
        }
      },
      {
        type: 'message',
        message: {
          id: 'assistant-2',
          role: 'assistant',
          content: 'second answer',
          createdAt: 4
        }
      }
    ]
    for (const event of events) {
      db.saveMessage(original.id, event)
    }

    const branched = branchSessionFromMessage({
      sessionId: original.id,
      messageId: 'user-2',
      action: 'edit',
      content: 'edited prompt'
    })

    expect(branched.session.parentSessionId).toBe(original.id)
    expect(branched.session.model).toBe('gpt-4o')
    expect(branched.session.adapter).toBe('codex')
    expect(branched.replayContent).toBe('edited prompt')
    expect(db.getMessages(branched.session.id)).toEqual([
      events[0],
      events[1]
    ])
    expect(db.getSessionRuntimeState(branched.session.id)).toEqual(expect.objectContaining({
      runtimeKind: 'interactive',
      historySeedPending: true,
      historySeed: expect.stringContaining('助手：first answer')
    }))
    expect(vi.mocked(notifySessionUpdated)).toHaveBeenCalledWith(
      branched.session.id,
      expect.objectContaining({
        parentSessionId: original.id,
        lastMessage: 'first answer',
        lastUserMessage: 'first prompt'
      })
    )
  })

  it('keeps legacy tool-call context in the history seed for branched sessions', () => {
    const original = db.createSession('Original', 'session-root', 'completed')
    const events: WSEvent[] = [
      {
        type: 'message',
        message: {
          id: 'user-1',
          role: 'user',
          content: 'first prompt',
          createdAt: 1
        }
      },
      {
        type: 'message',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          content: '',
          toolCall: {
            name: 'ReadFile',
            args: { path: '/tmp/demo.md' },
            status: 'success',
            output: { snippet: 'hello world' }
          },
          createdAt: 2
        }
      },
      {
        type: 'message',
        message: {
          id: 'user-2',
          role: 'user',
          content: 'follow up',
          createdAt: 3
        }
      }
    ]

    for (const event of events) {
      db.saveMessage(original.id, event)
    }

    const branched = branchSessionFromMessage({
      sessionId: original.id,
      messageId: 'user-2',
      action: 'edit',
      content: 'edited prompt'
    })

    expect(db.getSessionRuntimeState(branched.session.id)).toEqual(expect.objectContaining({
      historySeed: expect.stringContaining('[工具调用:ReadFile]')
    }))
    expect(db.getSessionRuntimeState(branched.session.id)).toEqual(expect.objectContaining({
      historySeed: expect.stringContaining('/tmp/demo.md')
    }))
    expect(db.getSessionRuntimeState(branched.session.id)).toEqual(expect.objectContaining({
      historySeed: expect.stringContaining('hello world')
    }))
  })

  it('supports editing a user message into mixed text and image content', () => {
    const original = db.createSession('Original', 'session-root', 'completed')
    const events: WSEvent[] = [
      {
        type: 'message',
        message: {
          id: 'user-1',
          role: 'user',
          content: 'first prompt',
          createdAt: 1
        }
      },
      {
        type: 'message',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          content: 'first answer',
          createdAt: 2
        }
      },
      {
        type: 'message',
        message: {
          id: 'user-2',
          role: 'user',
          content: 'second prompt',
          createdAt: 3
        }
      }
    ]
    for (const event of events) {
      db.saveMessage(original.id, event)
    }

    const editedContent: ChatMessageContent[] = [
      { type: 'text', text: 'edited prompt' },
      {
        type: 'image',
        url: 'data:image/png;base64,abc',
        name: 'edited.png',
        mimeType: 'image/png'
      }
    ]
    const branched = branchSessionFromMessage({
      sessionId: original.id,
      messageId: 'user-2',
      action: 'edit',
      content: editedContent
    })

    expect(branched.replayContent).toEqual(editedContent)
    expect(db.getMessages(branched.session.id)).toEqual([events[0], events[1]])
  })

  it('recalls from a user message by trimming later history into a child session', () => {
    const original = db.createSession('Original', 'session-root', 'completed')
    const events: WSEvent[] = [
      {
        type: 'message',
        message: {
          id: 'user-1',
          role: 'user',
          content: 'first prompt',
          createdAt: 1
        }
      },
      {
        type: 'message',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          content: 'first answer',
          createdAt: 2
        }
      },
      {
        type: 'message',
        message: {
          id: 'user-2',
          role: 'user',
          content: 'second prompt',
          createdAt: 3
        }
      }
    ]
    for (const event of events) {
      db.saveMessage(original.id, event)
    }

    const branched = branchSessionFromMessage({
      sessionId: original.id,
      messageId: 'user-2',
      action: 'recall'
    })

    expect(branched.replayContent).toBeUndefined()
    expect(db.getMessages(branched.session.id)).toEqual([events[0], events[1]])
    expect(branched.session.lastMessage).toBe('first answer')
    expect(branched.session.lastUserMessage).toBe('first prompt')
  })

  it('forks from a user message by replaying it into a child session', () => {
    const original = db.createSession('Original', 'session-root', 'completed')
    const events: WSEvent[] = [
      {
        type: 'message',
        message: {
          id: 'user-1',
          role: 'user',
          content: 'first prompt',
          createdAt: 1
        }
      },
      {
        type: 'message',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          content: 'first answer',
          createdAt: 2
        }
      },
      {
        type: 'message',
        message: {
          id: 'user-2',
          role: 'user',
          content: 'follow up',
          createdAt: 3
        }
      }
    ]
    for (const event of events) {
      db.saveMessage(original.id, event)
    }

    const branched = branchSessionFromMessage({
      sessionId: original.id,
      messageId: 'user-2',
      action: 'fork'
    })

    expect(db.getMessages(branched.session.id)).toEqual([events[0], events[1]])
    expect(branched.replayContent).toBe('follow up')
    expect(branched.session.lastMessage).toBe('first answer')
    expect(branched.session.lastUserMessage).toBe('first prompt')
  })

  it('rejects forking from an assistant message', () => {
    const original = db.createSession('Original', 'session-root', 'completed')
    db.saveMessage(original.id, {
      type: 'message',
      message: {
        id: 'user-1',
        role: 'user',
        content: 'first prompt',
        createdAt: 1
      }
    })
    db.saveMessage(original.id, {
      type: 'message',
      message: {
        id: 'assistant-1',
        role: 'assistant',
        content: 'first answer',
        createdAt: 2
      }
    })

    expect(() => branchSessionFromMessage({
      sessionId: original.id,
      messageId: 'assistant-1',
      action: 'fork'
    })).toThrowError('Only user messages can be forked')
  })
})
