import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  generateAdapterQueryOptions: vi.fn(),
  callHook: vi.fn(),
  loadInjectDefaultSystemPromptValue: vi.fn(),
  mergeSystemPrompts: vi.fn(),
  extractTextFromMessage: vi.fn(),
  postSessionEvent: vi.fn(),
  fetchSessionMessages: vi.fn()
}))

vi.mock('@vibe-forge/task', () => ({
  run: mocks.run,
  generateAdapterQueryOptions: mocks.generateAdapterQueryOptions
}))

vi.mock('@vibe-forge/hooks', () => ({
  callHook: mocks.callHook
}))

vi.mock('@vibe-forge/config', () => ({
  loadInjectDefaultSystemPromptValue: mocks.loadInjectDefaultSystemPromptValue,
  mergeSystemPrompts: mocks.mergeSystemPrompts
}))

vi.mock('@vibe-forge/utils/chat-message', () => ({
  extractTextFromMessage: mocks.extractTextFromMessage
}))

vi.mock('#~/sync.js', () => ({
  postSessionEvent: mocks.postSessionEvent,
  fetchSessionMessages: mocks.fetchSessionMessages
}))

describe('taskManager fatal error scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.generateAdapterQueryOptions.mockResolvedValue([
      {},
      {
        systemPrompt: undefined,
        tools: undefined,
        skills: undefined,
        mcpServers: undefined
      }
    ])
    mocks.callHook.mockResolvedValue(undefined)
    mocks.loadInjectDefaultSystemPromptValue.mockResolvedValue(true)
    mocks.mergeSystemPrompts.mockReturnValue(undefined)
    mocks.postSessionEvent.mockResolvedValue(undefined)
    mocks.fetchSessionMessages.mockResolvedValue([])
    mocks.extractTextFromMessage.mockReturnValue('')
  })

  it('keeps the task failed when a fatal error is followed by stop', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')

    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      const session = {
        emit: vi.fn(() => {
          adapterOptions.onEvent({
            type: 'error',
            data: {
              message: 'Incomplete response returned',
              fatal: true
            }
          })
          adapterOptions.onEvent({
            type: 'stop',
            data: undefined
          })
        }),
        kill: vi.fn()
      }
      return { session }
    })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-fatal-stop',
      description: 'trigger',
      background: false
    })

    const task = managedTaskManager.getTask('task-fatal-stop')
    expect(task?.status).toBe('failed')
    expect(task?.logs).toContain('Incomplete response returned')
  })
})
