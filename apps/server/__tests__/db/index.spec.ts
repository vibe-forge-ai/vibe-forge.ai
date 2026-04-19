import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SqliteDb } from '#~/db/index.js'
import { createSqliteDatabase } from '#~/db/sqlite.js'
import type { SqliteDatabase } from '#~/db/sqlite.js'

describe('sqliteDb', () => {
  let sqlite: SqliteDatabase
  let db: SqliteDb

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-18T00:00:00.000Z'))
    sqlite = createSqliteDatabase(':memory:')
    db = new SqliteDb({ db: sqlite })
  })

  afterEach(() => {
    db.close()
    vi.useRealTimers()
  })

  it('keeps session, message and tag persistence compatible through the public API', () => {
    const root = db.createSession('Root session', 'session-root', 'running')

    db.saveMessage(root.id, { role: 'user', content: 'hello' })
    db.updateSession(root.id, {
      lastMessage: 'assistant reply',
      lastUserMessage: 'hello',
      isStarred: true,
      model: 'gpt-test',
      adapter: 'adapter-test',
      permissionMode: 'plan',
      workspaceFileState: {
        openPaths: ['apps/client/src/routes/ChatRouteView.tsx'],
        selectedPath: 'apps/client/src/routes/ChatRouteView.tsx',
        isOpen: true
      }
    })
    db.updateSessionTags(root.id, ['alpha', 'beta', 'alpha'])

    const stored = db.getSession(root.id)
    expect(stored).toEqual({
      id: 'session-root',
      title: 'Root session',
      createdAt: Date.now(),
      messageCount: 1,
      lastMessage: 'assistant reply',
      lastUserMessage: 'hello',
      isStarred: true,
      isArchived: false,
      tags: expect.any(Array),
      status: 'running',
      model: 'gpt-test',
      adapter: 'adapter-test',
      permissionMode: 'plan',
      workspaceFileState: {
        openPaths: ['apps/client/src/routes/ChatRouteView.tsx'],
        selectedPath: 'apps/client/src/routes/ChatRouteView.tsx',
        isOpen: true
      }
    })
    expect(stored?.tags?.slice().sort()).toEqual(['alpha', 'beta'])
    expect(db.getMessages(root.id)).toEqual([{ role: 'user', content: 'hello' }])

    const child = db.createSession('Child session', 'session-child', 'completed', root.id, {
      runtimeKind: 'interactive',
      historySeed: 'seed prompt',
      historySeedPending: true
    })
    db.copyMessages(root.id, child.id)

    expect(db.getMessages(child.id)).toEqual([{ role: 'user', content: 'hello' }])
    expect(db.getSession(child.id)).toEqual(expect.objectContaining({
      id: 'session-child',
      parentSessionId: 'session-root',
      status: 'completed',
      messageCount: 1
    }))
    expect(db.getSessionRuntimeState(child.id)).toEqual({
      runtimeKind: 'interactive',
      historySeed: 'seed prompt',
      historySeedPending: true,
      permissionState: {
        allow: [],
        deny: [],
        onceAllow: [],
        onceDeny: []
      }
    })
  })

  it('archives a session tree without affecting unrelated sessions', () => {
    db.createSession('Parent', 'parent')
    db.createSession('Child', 'child', undefined, 'parent')
    db.createSession('Grandchild', 'grandchild', undefined, 'child')
    db.createSession('Sibling', 'sibling')

    const updatedIds = db.updateSessionArchivedWithChildren('parent', true)

    expect(updatedIds.slice().sort()).toEqual(['child', 'grandchild', 'parent'])
    expect(db.getSession('parent')).toEqual(expect.objectContaining({ isArchived: true }))
    expect(db.getSession('child')).toEqual(expect.objectContaining({ isArchived: true }))
    expect(db.getSession('grandchild')).toEqual(expect.objectContaining({ isArchived: true }))
    expect(db.getSession('sibling')).toEqual(expect.objectContaining({ isArchived: false }))
  })

  it('returns the latest channel session mapping for a session id', () => {
    db.createSession('Mapped session', 'session-mapped')

    vi.setSystemTime(new Date('2026-03-18T00:00:00.000Z'))
    db.upsertChannelSession({
      channelType: 'lark',
      sessionType: 'thread',
      channelId: 'channel-1',
      channelKey: 'key-1',
      sessionId: 'session-mapped',
      replyReceiveId: 'reply-1',
      replyReceiveIdType: 'message'
    })

    vi.setSystemTime(new Date('2026-03-18T00:00:05.000Z'))
    db.upsertChannelSession({
      channelType: 'lark',
      sessionType: 'thread',
      channelId: 'channel-2',
      channelKey: 'key-2',
      sessionId: 'session-mapped',
      replyReceiveId: 'reply-2',
      replyReceiveIdType: 'message'
    })

    expect(db.getChannelSession('lark', 'thread', 'channel-1')).toEqual(expect.objectContaining({
      channelKey: 'key-1',
      sessionId: 'session-mapped'
    }))
    expect(db.getChannelSessionBySessionId('session-mapped')).toEqual(expect.objectContaining({
      channelId: 'channel-2',
      channelKey: 'key-2',
      updatedAt: Date.now()
    }))
  })

  it('persists channel adapter preferences independently of the current session binding', () => {
    db.upsertChannelPreference({
      channelType: 'lark',
      sessionType: 'direct',
      channelId: 'channel-1',
      channelKey: 'key-1',
      adapter: 'codex',
      permissionMode: 'bypassPermissions',
      effort: 'high'
    })

    expect(db.getChannelPreference('lark', 'direct', 'channel-1')).toEqual(expect.objectContaining({
      channelKey: 'key-1',
      adapter: 'codex',
      permissionMode: 'bypassPermissions',
      effort: 'high'
    }))
  })

  it('updates automation rules with nullable fields through the same API surface', () => {
    db.createAutomationRule({
      id: 'rule-1',
      name: 'Nightly run',
      description: 'original',
      type: 'interval',
      intervalMs: 3000,
      webhookKey: null,
      cronExpression: null,
      prompt: 'do work',
      enabled: true,
      createdAt: Date.now(),
      lastRunAt: null,
      lastSessionId: null
    })

    db.updateAutomationRule('rule-1', {
      description: null,
      intervalMs: null,
      webhookKey: 'hook-1',
      enabled: false,
      lastRunAt: 123,
      lastSessionId: 'session-root'
    })

    expect(db.getAutomationRule('rule-1')).toEqual({
      id: 'rule-1',
      name: 'Nightly run',
      description: null,
      type: 'interval',
      intervalMs: null,
      webhookKey: 'hook-1',
      cronExpression: null,
      prompt: 'do work',
      enabled: false,
      createdAt: Date.now(),
      lastRunAt: 123,
      lastSessionId: 'session-root'
    })
  })

  it('replaces automation triggers and tasks atomically and exposes rule details with runs', () => {
    db.createAutomationRule({
      id: 'rule-1',
      name: 'Nightly run',
      description: null,
      type: 'cron',
      intervalMs: null,
      webhookKey: null,
      cronExpression: '0 0 * * *',
      prompt: 'do work',
      enabled: true,
      createdAt: Date.now(),
      lastRunAt: null,
      lastSessionId: null
    })

    db.replaceAutomationTriggers('rule-1', [
      {
        id: 'trigger-1',
        type: 'cron',
        cronExpression: '0 0 * * *'
      }
    ])
    db.replaceAutomationTasks('rule-1', [
      {
        id: 'task-1',
        title: 'Task A',
        prompt: 'Summarize activity'
      }
    ])

    db.createSession('Automation run', 'session-run', 'completed')
    db.updateSessionLastMessages('session-run', 'assistant summary', 'user request')
    db.createAutomationRun('rule-1', 'session-run', 'task-1', 'Task A')

    expect(db.getAutomationRuleDetail('rule-1')).toEqual({
      id: 'rule-1',
      name: 'Nightly run',
      description: null,
      type: 'cron',
      intervalMs: null,
      webhookKey: null,
      cronExpression: '0 0 * * *',
      prompt: 'do work',
      enabled: true,
      createdAt: Date.now(),
      lastRunAt: null,
      lastSessionId: null,
      triggers: [
        {
          id: 'trigger-1',
          ruleId: 'rule-1',
          type: 'cron',
          intervalMs: null,
          cronExpression: '0 0 * * *',
          webhookKey: null,
          createdAt: Date.now()
        }
      ],
      tasks: [
        {
          id: 'task-1',
          ruleId: 'rule-1',
          title: 'Task A',
          prompt: 'Summarize activity',
          createdAt: Date.now()
        }
      ]
    })
    expect(db.listAutomationRuns('rule-1')).toEqual([
      {
        id: expect.any(String),
        ruleId: 'rule-1',
        sessionId: 'session-run',
        runAt: Date.now(),
        taskId: 'task-1',
        taskTitle: 'Task A',
        status: 'completed',
        title: 'Automation run',
        lastMessage: 'assistant summary',
        lastUserMessage: 'user request'
      }
    ])
  })

  it('rolls back trigger replacement when a later insert fails', () => {
    db.createAutomationRule({
      id: 'rule-1',
      name: 'Nightly run',
      description: null,
      type: 'interval',
      intervalMs: 3000,
      webhookKey: null,
      cronExpression: null,
      prompt: 'do work',
      enabled: true,
      createdAt: Date.now(),
      lastRunAt: null,
      lastSessionId: null
    })

    db.replaceAutomationTriggers('rule-1', [
      {
        id: 'trigger-existing',
        type: 'interval',
        intervalMs: 3000
      }
    ])

    expect(() =>
      db.replaceAutomationTriggers('rule-1', [
        {
          id: 'trigger-duplicate',
          type: 'interval',
          intervalMs: 1000
        },
        {
          id: 'trigger-duplicate',
          type: 'cron',
          cronExpression: '* * * * *'
        }
      ])
    ).toThrowError()

    expect(db.listAutomationTriggers('rule-1')).toEqual([
      {
        id: 'trigger-existing',
        ruleId: 'rule-1',
        type: 'interval',
        intervalMs: 3000,
        cronExpression: null,
        webhookKey: null,
        createdAt: Date.now()
      }
    ])
  })
})
