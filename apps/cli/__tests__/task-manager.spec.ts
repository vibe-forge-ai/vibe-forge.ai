import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  generateAdapterQueryOptions: vi.fn(),
  callHook: vi.fn(),
  loadInjectDefaultSystemPromptValue: vi.fn(),
  mergeSystemPrompts: vi.fn(),
  postSessionEvent: vi.fn(),
  fetchSessionMessages: vi.fn(),
  extractTextFromMessage: vi.fn()
}))

vi.mock('@vibe-forge/core/controllers/task', () => ({
  generateAdapterQueryOptions: mocks.generateAdapterQueryOptions,
  run: mocks.run
}))

vi.mock('@vibe-forge/core/hooks', () => ({
  callHook: mocks.callHook
}))

vi.mock('#~/system-prompt.js', () => ({
  loadInjectDefaultSystemPromptValue: mocks.loadInjectDefaultSystemPromptValue,
  mergeSystemPrompts: mocks.mergeSystemPrompts
}))

vi.mock('#~/mcp-sync/index.js', () => ({
  postSessionEvent: mocks.postSessionEvent,
  fetchSessionMessages: mocks.fetchSessionMessages,
  extractTextFromMessage: mocks.extractTextFromMessage
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
    const { taskManager } = await import('../src/mcp-tools/task/manager')

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

    await taskManager.startTask({
      taskId: 'task-fatal-stop',
      description: 'trigger',
      background: false
    })

    const task = taskManager.getTask('task-fatal-stop')
    expect(task?.status).toBe('failed')
    expect(task?.logs).toContain('Incomplete response returned')
  })
})
