import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createToolTester } from './mcp-test-utils.js'

const mocks = vi.hoisted(() => {
  return {
    callHook: vi.fn(),
    createChildSession: vi.fn(),
    getParentSessionId: vi.fn(),
    startTask: vi.fn(),
    submitTaskInput: vi.fn(),
    respondToTaskInteraction: vi.fn(),
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
    submitTaskInput = mocks.submitTaskInput
    respondToTaskInteraction = mocks.respondToTaskInteraction
    getTask = mocks.getTask
    stopTask = mocks.stopTask
    getAllTasks = mocks.getAllTasks
  }
}))

describe('task tool integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.__VF_PROJECT_AI_SESSION_ID__ = 'sess-1'
    delete process.env.__VF_PROJECT_AI_PERMISSION_MODE__
    let nextTaskId = 1
    mocks.uuid.mockImplementation(() => `task-${nextTaskId++}`)
    mocks.callHook.mockResolvedValue({ continue: true })
    mocks.getParentSessionId.mockReturnValue(undefined)
    mocks.createChildSession.mockResolvedValue({})
    mocks.startTask.mockResolvedValue(undefined)
    mocks.submitTaskInput.mockResolvedValue(undefined)
    mocks.respondToTaskInteraction.mockResolvedValue(undefined)
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

    expect(mocks.callHook).toHaveBeenCalledWith(
      'StartTasks',
      expect.objectContaining({
        sessionId: 'sess-1',
        tasks: [expect.objectContaining({
          taskId: 'task-1',
          description: 'only output ok',
          type: 'default',
          background: false
        })]
      })
    )
    expect(mocks.startTask).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1'
    }))
  })

  it('accepts workspace tasks without a separate workspace tool', async () => {
    const { createTaskRegister } = await import('#~/tools/task/index.js')

    const tester = createToolTester()
    createTaskRegister()(tester.mockRegister)

    await tester.callTool('StartTasks', {
      tasks: [{
        description: 'fix billing',
        type: 'workspace',
        name: 'billing'
      }]
    })

    expect(mocks.startTask).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      description: 'fix billing',
      type: 'workspace',
      name: 'billing'
    }))
  })

  it('inherits the parent permission mode when the task does not specify one', async () => {
    process.env.__VF_PROJECT_AI_PERMISSION_MODE__ = 'dontAsk'
    mocks.getParentSessionId.mockReturnValue('parent-session')

    const { createTaskRegister } = await import('#~/tools/task/index.js')

    const tester = createToolTester()
    createTaskRegister()(tester.mockRegister)

    await tester.callTool('StartTasks', {
      tasks: [{
        description: 'inherit permissions',
        type: 'default'
      }]
    })

    expect(mocks.callHook).toHaveBeenCalledWith(
      'StartTasks',
      expect.objectContaining({
        tasks: [expect.objectContaining({
          taskId: 'task-1',
          permissionMode: 'dontAsk'
        })]
      })
    )
    expect(mocks.createChildSession).toHaveBeenCalledWith(expect.objectContaining({
      id: 'task-1',
      parentSessionId: 'parent-session',
      permissionMode: 'dontAsk'
    }))
    expect(mocks.startTask).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      permissionMode: 'dontAsk',
      enableServerSync: true
    }))
  })

  it('keeps an explicit task permission mode over the inherited parent mode', async () => {
    process.env.__VF_PROJECT_AI_PERMISSION_MODE__ = 'dontAsk'

    const { createTaskRegister } = await import('#~/tools/task/index.js')

    const tester = createToolTester()
    createTaskRegister()(tester.mockRegister)

    await tester.callTool('StartTasks', {
      tasks: [{
        description: 'override permissions',
        type: 'default',
        permissionMode: 'plan'
      }]
    })

    expect(mocks.startTask).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      permissionMode: 'plan'
    }))
  })

  it('registers recovery guidance in task tool descriptions', async () => {
    const { createTaskRegister } = await import('#~/tools/task/index.js')

    const tester = createToolTester()
    createTaskRegister()(tester.mockRegister)

    expect(tester.getRegisteredTools()).toContain('SubmitTaskInput')
    expect(tester.getRegisteredTools()).toContain('RespondTaskInteraction')
    expect(tester.getToolInfo('StartTasks')?.description).toContain('GetTaskInfo')
    expect(tester.getToolInfo('GetTaskInfo')?.description).toContain('SubmitTaskInput')
    expect(tester.getToolInfo('ListTasks')?.description).toContain('pendingInput')
    expect(tester.getToolInfo('SubmitTaskInput')?.description).toContain('allow_once')
    expect(tester.getToolInfo('RespondTaskInteraction')?.description).toContain('Deprecated alias')
  })

  it('forwards SubmitTaskInput to the task manager', async () => {
    mocks.getTask.mockReturnValue({
      taskId: 'task-1',
      status: 'running',
      logs: ['Interaction response submitted: allow_once']
    })

    const { createTaskRegister } = await import('#~/tools/task/index.js')

    const tester = createToolTester()
    createTaskRegister()(tester.mockRegister)

    await tester.callTool('SubmitTaskInput', {
      taskId: 'task-1',
      data: 'allow_once'
    })

    expect(mocks.submitTaskInput).toHaveBeenCalledWith({
      taskId: 'task-1',
      interactionId: undefined,
      data: 'allow_once'
    })
  })

  it('keeps RespondTaskInteraction as a deprecated alias', async () => {
    mocks.getTask.mockReturnValue({
      taskId: 'task-1',
      status: 'running',
      logs: ['Interaction response submitted: allow_once']
    })

    const { createTaskRegister } = await import('#~/tools/task/index.js')

    const tester = createToolTester()
    createTaskRegister()(tester.mockRegister)

    await tester.callTool('RespondTaskInteraction', {
      taskId: 'task-1',
      response: 'allow_once'
    })

    expect(mocks.submitTaskInput).toHaveBeenCalledWith({
      taskId: 'task-1',
      interactionId: undefined,
      data: 'allow_once'
    })
  })
})
