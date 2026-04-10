import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createToolTester } from './mcp-test-utils.js'

const mocks = vi.hoisted(() => {
  return {
    callHook: vi.fn(),
    createChildSession: vi.fn(),
    getParentSessionId: vi.fn(),
    startTask: vi.fn(),
    getTask: vi.fn(),
    stopTask: vi.fn(),
    getAllTasks: vi.fn(),
    uuid: vi.fn()
  }
})

vi.mock('@vibe-forge/hooks', () => ({
  callHook: mocks.callHook
}))

vi.mock('@vibe-forge/utils/uuid', () => ({
  uuid: mocks.uuid
}))

vi.mock('#~/sync.js', () => ({
  createChildSession: mocks.createChildSession,
  getParentSessionId: mocks.getParentSessionId
}))

vi.mock('#~/tools/task/manager.js', () => ({
  TaskManager: class {
    startTask = mocks.startTask
    getTask = mocks.getTask
    stopTask = mocks.stopTask
    getAllTasks = mocks.getAllTasks
  }
}))

describe('task tool integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.__VF_PROJECT_AI_SESSION_ID__ = 'sess-1'
    let nextTaskId = 1
    mocks.uuid.mockImplementation(() => `task-${nextTaskId++}`)
    mocks.callHook.mockResolvedValue({ continue: true })
    mocks.getParentSessionId.mockReturnValue(undefined)
    mocks.startTask.mockResolvedValue(undefined)
    mocks.getTask.mockImplementation((taskId: string) => ({
      taskId,
      status: 'completed',
      logs: []
    }))
    mocks.stopTask.mockReturnValue(true)
    mocks.getAllTasks.mockReturnValue([])
  })

  it('passes resolved task ids to the StartTasks hook', async () => {
    const { createTaskRegister } = await import('#~/tools/task/index.js')

    const tester = createToolTester()
    createTaskRegister()(tester.mockRegister)

    await tester.callTool('StartTasks', {
      tasks: [{
        description: 'only output ok',
        type: 'default',
        background: false
      }]
    })

    expect(mocks.callHook).toHaveBeenCalledWith('StartTasks', expect.objectContaining({
      sessionId: 'sess-1',
      tasks: [expect.objectContaining({
        taskId: 'task-1',
        description: 'only output ok',
        type: 'default',
        background: false
      })]
    }))
    expect(mocks.startTask).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1'
    }))
  })
})
