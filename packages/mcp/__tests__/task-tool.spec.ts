import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createToolTester } from './mcp-test-utils.js'

const mocks = vi.hoisted(() => {
  return {
    callHook: vi.fn(),
    createChildSession: vi.fn(),
    getParentSessionId: vi.fn(),
    startTask: vi.fn(),
    sendTaskMessage: vi.fn(),
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
    sendTaskMessage = mocks.sendTaskMessage
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
    mocks.sendTaskMessage.mockResolvedValue(undefined)
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

    expect(tester.getRegisteredTools()).toContain('SendTaskMessage')
    expect(tester.getRegisteredTools()).toContain('SubmitTaskInput')
    expect(tester.getRegisteredTools()).toContain('RespondTaskInteraction')
    expect(tester.getToolInfo('StartTasks')?.description).toContain('GetTaskInfo')
    expect(tester.getToolInfo('StartTasks')?.description).toContain('SendTaskMessage')
    expect(tester.getToolInfo('GetTaskInfo')?.description).toContain('10 most recent logs')
    expect(tester.getToolInfo('GetTaskInfo')?.description).toContain('logOrder')
    expect(tester.getToolInfo('GetTaskInfo')?.description).toContain('SendTaskMessage')
    expect(tester.getToolInfo('SendTaskMessage')?.description).toContain('still running')
    expect(tester.getToolInfo('ListTasks')?.description).toContain('10 most recent logs')
    expect(tester.getToolInfo('ListTasks')?.description).toContain('SendTaskMessage')
    expect(tester.getToolInfo('ListTasks')?.description).toContain('pendingInput')
    expect(tester.getToolInfo('SubmitTaskInput')?.description).toContain('SendTaskMessage')
    expect(tester.getToolInfo('SubmitTaskInput')?.description).toContain('allow_once')
    expect(tester.getToolInfo('RespondTaskInteraction')?.description).toContain('Deprecated alias')
  })

  it('returns the 10 most recent logs in descending order by default', async () => {
    mocks.getTask.mockReturnValue({
      taskId: 'task-1',
      status: 'running',
      logs: Array.from({ length: 12 }, (_, index) => `log-${index + 1}`)
    })

    const { createTaskRegister } = await import('#~/tools/task/index.js')

    const tester = createToolTester()
    createTaskRegister()(tester.mockRegister)

    const result = await tester.callTool('GetTaskInfo', {
      taskId: 'task-1'
    }) as { content: Array<{ text: string }> }
    const [task] = JSON.parse(result.content[0].text) as Array<{ logs: string[] }>

    expect(task.logs).toEqual([
      'log-12',
      'log-11',
      'log-10',
      'log-9',
      'log-8',
      'log-7',
      'log-6',
      'log-5',
      'log-4',
      'log-3'
    ])
  })

  it('supports custom log windows and ascending order in ListTasks', async () => {
    mocks.getAllTasks.mockReturnValue([
      {
        taskId: 'task-1',
        status: 'running',
        logs: ['a', 'b', 'c', 'd']
      },
      {
        taskId: 'task-2',
        status: 'completed',
        logs: ['1', '2', '3']
      }
    ])

    const { createTaskRegister } = await import('#~/tools/task/index.js')

    const tester = createToolTester()
    createTaskRegister()(tester.mockRegister)

    const result = await tester.callTool('ListTasks', {
      logLimit: 2,
      logOrder: 'asc'
    }) as { content: Array<{ text: string }> }
    const tasks = JSON.parse(result.content[0].text) as Array<{ taskId: string; logs: string[] }>

    expect(tasks).toEqual([
      {
        taskId: 'task-1',
        status: 'running',
        logs: ['c', 'd'],
        guidance: []
      },
      {
        taskId: 'task-2',
        status: 'completed',
        logs: ['2', '3'],
        guidance: []
      }
    ])
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

  it('forwards SendTaskMessage to the task manager', async () => {
    mocks.getTask.mockReturnValue({
      taskId: 'task-1',
      status: 'running',
      logs: ['User message submitted: keep checking logs']
    })

    const { createTaskRegister } = await import('#~/tools/task/index.js')

    const tester = createToolTester()
    createTaskRegister()(tester.mockRegister)

    await tester.callTool('SendTaskMessage', {
      taskId: 'task-1',
      message: 'keep checking logs'
    })

    expect(mocks.sendTaskMessage).toHaveBeenCalledWith({
      taskId: 'task-1',
      message: 'keep checking logs'
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
