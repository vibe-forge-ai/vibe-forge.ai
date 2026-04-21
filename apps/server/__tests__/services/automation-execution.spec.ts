import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '#~/db/index.js'
import { runAutomationRule } from '#~/services/automation/execution.js'
import { createSessionWithInitialMessage } from '#~/services/session/create.js'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createSessionWithInitialMessage: vi.fn()
}))

vi.mock('#~/db/index.js', () => ({
  getDb: mocks.getDb
}))

vi.mock('#~/services/session/create.js', () => ({
  createSessionWithInitialMessage: mocks.createSessionWithInitialMessage
}))

describe('automation execution', () => {
  const getAutomationRule = vi.fn()
  const listAutomationTriggers = vi.fn()
  const listAutomationTasks = vi.fn()
  const createAutomationRun = vi.fn()
  const updateAutomationRule = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDb).mockReturnValue({
      getAutomationRule,
      listAutomationTriggers,
      listAutomationTasks,
      createAutomationRun,
      updateAutomationRule
    } as any)
    vi.mocked(createSessionWithInitialMessage).mockResolvedValue({
      id: 'session-1',
      createdAt: Date.now()
    } as any)
    listAutomationTriggers.mockReturnValue([{ id: 'trigger-1', type: 'interval' }])
    listAutomationTasks.mockReturnValue([{
      id: 'task-1',
      title: 'Task A',
      prompt: 'Do work',
      model: 'gpt-responses,gpt-5.4',
      adapter: 'codex',
      effort: 'high',
      permissionMode: 'bypassPermissions',
      createWorktree: true,
      branchName: 'codex/nightly',
      branchKind: null,
      branchMode: 'create'
    }])
  })

  it('passes task startup parameters into created sessions', async () => {
    getAutomationRule.mockReturnValue({
      id: 'rule-1',
      name: 'Nightly',
      type: 'interval',
      prompt: 'Do work',
      enabled: true
    })

    await runAutomationRule('rule-1')

    expect(createSessionWithInitialMessage).toHaveBeenCalledWith(expect.objectContaining({
      adapter: 'codex',
      effort: 'high',
      initialMessage: 'Do work',
      model: 'gpt-responses,gpt-5.4',
      permissionMode: 'bypassPermissions',
      workspace: {
        createWorktree: true,
        branch: {
          name: 'codex/nightly',
          kind: undefined,
          mode: 'create'
        }
      }
    }))
    expect(createAutomationRun).toHaveBeenCalledWith('rule-1', 'session-1', 'task-1', 'Task A')
  })
})
