import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  generateAdapterQueryOptions: vi.fn(),
  callHook: vi.fn(),
  buildConfigJsonVariables: vi.fn(),
  loadConfig: vi.fn(),
  updateConfigFile: vi.fn(),
  loadInjectDefaultSystemPromptValue: vi.fn(),
  mergeSystemPrompts: vi.fn(),
  extractTextFromMessage: vi.fn(),
  postSessionEvent: vi.fn(),
  fetchSessionMessages: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('@vibe-forge/task', () => ({
  run: mocks.run,
  generateAdapterQueryOptions: mocks.generateAdapterQueryOptions
}))

vi.mock('@vibe-forge/hooks', () => ({
  callHook: mocks.callHook
}))

vi.mock('@vibe-forge/config', () => ({
  buildConfigJsonVariables: mocks.buildConfigJsonVariables,
  loadConfig: mocks.loadConfig,
  updateConfigFile: mocks.updateConfigFile,
  loadInjectDefaultSystemPromptValue: mocks.loadInjectDefaultSystemPromptValue,
  mergeSystemPrompts: mocks.mergeSystemPrompts
}))

vi.mock('@vibe-forge/utils/chat-message', () => ({
  extractTextFromMessage: mocks.extractTextFromMessage
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile
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
    mocks.buildConfigJsonVariables.mockReturnValue({})
    mocks.loadConfig.mockResolvedValue([undefined, undefined])
    mocks.updateConfigFile.mockResolvedValue(undefined)
    mocks.callHook.mockResolvedValue(undefined)
    mocks.loadInjectDefaultSystemPromptValue.mockResolvedValue(true)
    mocks.mergeSystemPrompts.mockReturnValue(undefined)
    mocks.postSessionEvent.mockResolvedValue(undefined)
    mocks.fetchSessionMessages.mockResolvedValue([])
    mocks.extractTextFromMessage.mockReturnValue('')
    mocks.mkdir.mockResolvedValue(undefined)
    mocks.writeFile.mockResolvedValue(undefined)
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

  it('surfaces pending interactions in logs and task state', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')

    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      const session = {
        emit: vi.fn(() => {
          adapterOptions.onEvent({
            type: 'interaction_request',
            data: {
              id: 'interaction-1',
              payload: {
                sessionId: 'task-waiting',
                kind: 'permission',
                question: 'Allow editing files?',
                options: [
                  { label: 'Allow once', value: 'allow_once' },
                  { label: 'Deny once', value: 'deny_once' }
                ]
              }
            }
          })
        }),
        kill: vi.fn(),
        respondInteraction: vi.fn()
      }
      return { session }
    })

    const managedTaskManager = new TaskManager()
    const result = await managedTaskManager.startTask({
      taskId: 'task-waiting',
      description: 'trigger',
      background: false
    })

    const task = managedTaskManager.getTask('task-waiting')
    expect(task?.status).toBe('waiting_input')
    expect(task?.pendingInteraction).toEqual({
      id: 'interaction-1',
      payload: expect.objectContaining({
        question: 'Allow editing files?'
      }),
      source: 'adapter'
    })
    expect(result.logs).toContain(
      'Waiting for permission input: Allow editing files? Available responses: allow_once, deny_once.'
    )
  })

  it('forwards task model overrides into query resolution and runtime startup', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')

    mocks.run.mockResolvedValueOnce({
      session: {
        emit: vi.fn(),
        kill: vi.fn()
      }
    })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-model-override',
      description: 'trigger',
      adapter: 'codex',
      model: 'openai,gpt-5.4-mini'
    })

    expect(mocks.generateAdapterQueryOptions).toHaveBeenCalledWith(
      undefined,
      undefined,
      expect.any(String),
      expect.objectContaining({
        adapter: 'codex',
        model: 'openai,gpt-5.4-mini'
      })
    )
    expect(mocks.run).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: 'codex'
      }),
      expect.objectContaining({
        sessionId: 'task-model-override',
        model: 'openai,gpt-5.4-mini'
      })
    )
    expect(managedTaskManager.getTask('task-model-override')).toEqual(expect.objectContaining({
      model: 'openai,gpt-5.4-mini'
    }))
  })

  it('uses the task id as the adapter cache context instead of an inherited parent context', async () => {
    process.env.__VF_PROJECT_AI_CTX_ID__ = 'parent-ctx'
    const { TaskManager } = await import('#~/tools/task/manager.js')

    mocks.run.mockResolvedValueOnce({
      session: {
        emit: vi.fn(),
        kill: vi.fn()
      }
    })

    try {
      const managedTaskManager = new TaskManager()
      await managedTaskManager.startTask({
        taskId: 'task-stable-context',
        description: 'trigger',
        adapter: 'codex'
      })
    } finally {
      delete process.env.__VF_PROJECT_AI_CTX_ID__
    }

    expect(mocks.run).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({
          __VF_PROJECT_AI_CTX_ID__: 'task-stable-context'
        })
      }),
      expect.objectContaining({
        sessionId: 'task-stable-context'
      })
    )
  })

  it('responds to pending interactions and syncs the response', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')
    const respondInteraction = vi.fn()

    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      const session = {
        emit: vi.fn(() => {
          adapterOptions.onEvent({
            type: 'interaction_request',
            data: {
              id: 'interaction-2',
              payload: {
                sessionId: 'task-respond',
                kind: 'permission',
                question: 'Allow bash?',
                options: [
                  { label: 'Allow once', value: 'allow_once' }
                ]
              }
            }
          })
        }),
        kill: vi.fn(),
        respondInteraction
      }
      return { session }
    })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-respond',
      description: 'trigger',
      enableServerSync: true
    })

    await managedTaskManager.respondToTaskInteraction({
      taskId: 'task-respond',
      data: 'allow_once'
    })

    const task = managedTaskManager.getTask('task-respond')
    expect(respondInteraction).toHaveBeenCalledWith('interaction-2', 'allow_once')
    expect(task?.status).toBe('running')
    expect(task?.pendingInteraction).toBeUndefined()
    expect(task?.logs).toContain('Interaction response submitted: allow_once')
    expect(mocks.postSessionEvent).toHaveBeenCalledWith('task-respond', {
      type: 'interaction_response',
      id: 'interaction-2',
      data: 'allow_once'
    })
  })

  it('sends a follow-up message directly to a running task without server sync', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')
    const emit = vi.fn()

    mocks.run.mockResolvedValueOnce({
      session: {
        emit,
        kill: vi.fn()
      }
    })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-send-local',
      description: 'trigger'
    })

    await managedTaskManager.sendTaskMessage({
      taskId: 'task-send-local',
      message: 'keep going'
    })

    const task = managedTaskManager.getTask('task-send-local')
    expect(emit).toHaveBeenNthCalledWith(2, {
      type: 'message',
      content: [{
        type: 'text',
        text: 'keep going'
      }]
    })
    expect(task?.logs).toContain('User message submitted (direct): keep going')
  })

  it('syncs follow-up messages through the child session when server sync is enabled', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')
    const emit = vi.fn()

    mocks.run.mockResolvedValueOnce({
      session: {
        emit,
        kill: vi.fn()
      }
    })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-send-synced',
      description: 'trigger',
      enableServerSync: true
    })

    await managedTaskManager.sendTaskMessage({
      taskId: 'task-send-synced',
      message: 'keep going'
    })

    const task = managedTaskManager.getTask('task-send-synced')
    expect(emit).toHaveBeenNthCalledWith(2, {
      type: 'message',
      content: [{
        type: 'text',
        text: 'keep going'
      }]
    })
    expect(mocks.postSessionEvent).toHaveBeenCalledWith('task-send-synced', {
      type: 'message',
      data: expect.objectContaining({
        role: 'user',
        content: 'keep going'
      })
    })
    expect(task?.logs).toContain('User message submitted (direct): keep going')
  })

  it('does not replay stale synced messages after a failed resume attempt', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')
    let onEvent: ((event: any) => void) | undefined
    const resumedEmit = vi.fn()
    const syncedEvents: Array<{ type: 'message'; message: Record<string, unknown> }> = []

    mocks.postSessionEvent.mockImplementation(async (_sessionId: string, payload: any) => {
      if (payload?.type === 'message' && payload.data != null) {
        syncedEvents.push({
          type: 'message',
          message: payload.data
        })
      }
    })
    mocks.fetchSessionMessages.mockImplementation(async () => syncedEvents)

    mocks.run
      .mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
        onEvent = adapterOptions.onEvent
        return {
          session: {
            emit: vi.fn(),
            kill: vi.fn()
          }
        }
      })
      .mockRejectedValueOnce(new Error('resume failed to start'))
      .mockResolvedValueOnce({
        session: {
          emit: resumedEmit,
          kill: vi.fn()
        }
      })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-send-synced-retry',
      description: 'trigger',
      enableServerSync: true
    })

    onEvent?.({
      type: 'stop',
      data: undefined
    })

    await expect(managedTaskManager.sendTaskMessage({
      taskId: 'task-send-synced-retry',
      message: 'first retry'
    })).rejects.toThrow('resume failed to start')

    const firstMessage = syncedEvents.at(-1)?.message
    const taskAfterFailure = managedTaskManager.getTask('task-send-synced-retry')
    expect(firstMessage).toEqual(expect.objectContaining({
      id: expect.any(String),
      role: 'user',
      content: 'first retry'
    }))
    expect(taskAfterFailure?.serverSync?.seenMessageIds.has(String(firstMessage?.id))).toBe(true)

    await managedTaskManager.sendTaskMessage({
      taskId: 'task-send-synced-retry',
      message: 'second retry'
    })
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(resumedEmit).toHaveBeenCalledTimes(1)
    expect(resumedEmit).toHaveBeenCalledWith({
      type: 'message',
      content: [{
        type: 'text',
        text: 'second retry'
      }]
    })

    managedTaskManager.stopTask('task-send-synced-retry')
  })

  it('queues steer follow-up messages and resumes the same task after natural completion', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')
    let onEvent: ((event: any) => void) | undefined
    const resumedEmit = vi.fn()

    mocks.run
      .mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
        onEvent = adapterOptions.onEvent
        return {
          session: {
            emit: vi.fn(),
            kill: vi.fn()
          }
        }
      })
      .mockResolvedValueOnce({
        session: {
          emit: resumedEmit,
          kill: vi.fn()
        }
      })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-send-steer',
      description: 'trigger'
    })

    await managedTaskManager.sendTaskMessage({
      taskId: 'task-send-steer',
      message: 'after you finish, summarize blockers',
      mode: 'steer'
    })

    onEvent?.({
      type: 'stop',
      data: undefined
    })
    await new Promise(resolve => setTimeout(resolve, 0))

    const task = managedTaskManager.getTask('task-send-steer')
    expect(mocks.run).toHaveBeenCalledTimes(2)
    expect(resumedEmit).toHaveBeenCalledWith({
      type: 'message',
      content: [{
        type: 'text',
        text: 'after you finish, summarize blockers'
      }]
    })
    expect(task?.logs).toContain('Queued task message (steer): after you finish, summarize blockers')
    expect(task?.logs).toContain('Resuming task from steer queue: after you finish, summarize blockers')
  })

  it('rejects follow-up messages when a task is waiting for input', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')

    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      const session = {
        emit: vi.fn(() => {
          adapterOptions.onEvent({
            type: 'interaction_request',
            data: {
              id: 'interaction-send-blocked',
              payload: {
                sessionId: 'task-send-blocked',
                kind: 'permission',
                question: 'Allow editing files?',
                options: [
                  { label: 'Allow once', value: 'allow_once' }
                ]
              }
            }
          })
        }),
        kill: vi.fn(),
        respondInteraction: vi.fn()
      }
      return { session }
    })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-send-blocked',
      description: 'trigger',
      background: false
    })

    await expect(managedTaskManager.sendTaskMessage({
      taskId: 'task-send-blocked',
      message: 'continue'
    })).rejects.toThrow('Task task-send-blocked is waiting for input. Use SubmitTaskInput instead.')
  })

  it('rejects steer follow-up messages when a task is waiting for input', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')

    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      const session = {
        emit: vi.fn(() => {
          adapterOptions.onEvent({
            type: 'interaction_request',
            data: {
              id: 'interaction-send-steer-blocked',
              payload: {
                sessionId: 'task-send-steer-blocked',
                kind: 'permission',
                question: 'Allow editing files?',
                options: [
                  { label: 'Allow once', value: 'allow_once' }
                ]
              }
            }
          })
        }),
        kill: vi.fn(),
        respondInteraction: vi.fn()
      }
      return { session }
    })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-send-steer-blocked',
      description: 'trigger',
      background: false
    })

    await expect(managedTaskManager.sendTaskMessage({
      taskId: 'task-send-steer-blocked',
      message: 'summarize blockers after this',
      mode: 'steer'
    })).rejects.toThrow('Task task-send-steer-blocked is waiting for input. Use SubmitTaskInput instead.')
  })

  it('resumes completed tasks when sending a direct follow-up message', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')
    let onEvent: ((event: any) => void) | undefined
    const resumedEmit = vi.fn()

    mocks.run
      .mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
        onEvent = adapterOptions.onEvent
        return {
          session: {
            emit: vi.fn(),
            kill: vi.fn()
          }
        }
      })
      .mockResolvedValueOnce({
        session: {
          emit: resumedEmit,
          kill: vi.fn()
        }
      })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-send-completed-direct',
      description: 'trigger'
    })

    onEvent?.({
      type: 'stop',
      data: undefined
    })

    await managedTaskManager.sendTaskMessage({
      taskId: 'task-send-completed-direct',
      message: 'continue from the final summary'
    })

    const task = managedTaskManager.getTask('task-send-completed-direct')
    expect(mocks.run).toHaveBeenCalledTimes(2)
    expect(resumedEmit).toHaveBeenCalledWith({
      type: 'message',
      content: [{
        type: 'text',
        text: 'continue from the final summary'
      }]
    })
    expect(task?.logs).toContain('Resuming inactive task (direct): continue from the final summary')
  })

  it('resumes completed tasks when sending a steer follow-up message', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')
    let onEvent: ((event: any) => void) | undefined
    const resumedEmit = vi.fn()

    mocks.run
      .mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
        onEvent = adapterOptions.onEvent
        return {
          session: {
            emit: vi.fn(),
            kill: vi.fn()
          }
        }
      })
      .mockResolvedValueOnce({
        session: {
          emit: resumedEmit,
          kill: vi.fn()
        }
      })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-send-completed-steer',
      description: 'trigger'
    })

    onEvent?.({
      type: 'stop',
      data: undefined
    })

    await managedTaskManager.sendTaskMessage({
      taskId: 'task-send-completed-steer',
      message: 'queue this for later',
      mode: 'steer'
    })

    const task = managedTaskManager.getTask('task-send-completed-steer')
    expect(mocks.run).toHaveBeenCalledTimes(2)
    expect(resumedEmit).toHaveBeenCalledWith({
      type: 'message',
      content: [{
        type: 'text',
        text: 'queue this for later'
      }]
    })
    expect(task?.logs).toContain('Resuming inactive task (steer): queue this for later')
  })

  it('builds synthetic permission recovery for claude-code and resumes after SubmitTaskInput', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')
    const resumedEmit = vi.fn()

    mocks.run
      .mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
        const session = {
          emit: vi.fn(() => {
            adapterOptions.onEvent({
              type: 'message',
              data: {
                id: 'assistant-tool-use',
                role: 'assistant',
                content: [{
                  type: 'tool_use',
                  id: 'tool-use-1',
                  name: 'adapter:claude-code:Write',
                  input: {
                    file_path: '/tmp/demo.txt',
                    content: 'ok'
                  }
                }],
                createdAt: Date.now()
              }
            })
            adapterOptions.onEvent({
              type: 'error',
              data: {
                message: 'Permission required to continue',
                code: 'permission_required',
                details: {
                  toolUseId: 'tool-use-1',
                  permissionDenials: [{
                    message: 'Write requires approval',
                    deniedTools: []
                  }]
                },
                fatal: true
              }
            })
            adapterOptions.onEvent({
              type: 'exit',
              data: {
                exitCode: 1,
                stderr: 'permission blocked'
              }
            })
          }),
          kill: vi.fn()
        }
        return {
          session,
          resolvedAdapter: 'claude-code'
        }
      })
      .mockResolvedValueOnce({
        session: {
          emit: resumedEmit,
          kill: vi.fn()
        },
        resolvedAdapter: 'claude-code'
      })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-claude-recovery',
      description: 'trigger',
      adapter: 'claude-code'
    })

    const waitingTask = managedTaskManager.getTask('task-claude-recovery')
    expect(waitingTask?.status).toBe('waiting_input')
    expect(waitingTask?.pendingInteraction).toMatchObject({
      source: 'permission_recovery',
      subjectKeys: ['Write'],
      payload: {
        question: '当前任务需要使用 Write 才能继续，请选择处理方式。',
        kind: 'permission',
        permissionContext: expect.objectContaining({
          currentMode: undefined,
          deniedTools: ['Write'],
          subjectKey: 'Write',
          subjectLabel: 'Write',
          projectConfigPath: '.ai.config.json'
        })
      }
    })

    await managedTaskManager.submitTaskInput({
      taskId: 'task-claude-recovery',
      data: 'allow_session'
    })

    const resumedTask = managedTaskManager.getTask('task-claude-recovery')
    expect(resumedTask?.status).toBe('running')
    expect(resumedTask?.pendingInteraction).toBeUndefined()
    expect(resumedTask?.permissionState).toEqual(expect.objectContaining({
      allow: ['Write']
    }))
    expect(resumedTask?.logs).toContain('Permission decision applied: allow_session. Restarting task.')
    expect(mocks.run).toHaveBeenCalledTimes(2)
    expect(resumedEmit).toHaveBeenCalledWith({
      type: 'message',
      content: [{
        type: 'text',
        text: '权限规则已更新。请继续刚才被权限拦截的工作，并重试被阻止的操作。'
      }]
    })
    expect(mocks.writeFile).toHaveBeenCalled()
  })

  it('stops blocked tasks even after the failed session has already exited', async () => {
    const { TaskManager } = await import('#~/tools/task/manager.js')

    mocks.run.mockImplementationOnce(async (_options: unknown, adapterOptions: any) => {
      const session = {
        emit: vi.fn(() => {
          adapterOptions.onEvent({
            type: 'message',
            data: {
              id: 'assistant-tool-use-stop',
              role: 'assistant',
              content: [{
                type: 'tool_use',
                id: 'tool-use-stop-1',
                name: 'adapter:claude-code:Write',
                input: {
                  file_path: '/tmp/demo.txt',
                  content: 'blocked'
                }
              }],
              createdAt: Date.now()
            }
          })
          adapterOptions.onEvent({
            type: 'error',
            data: {
              message: 'Permission required to continue',
              code: 'permission_required',
              details: {
                toolUseId: 'tool-use-stop-1',
                permissionDenials: [{
                  message: 'Write requires approval',
                  deniedTools: []
                }]
              },
              fatal: true
            }
          })
          adapterOptions.onEvent({
            type: 'exit',
            data: {
              exitCode: 1,
              stderr: 'permission blocked'
            }
          })
        }),
        kill: vi.fn()
      }
      return {
        session,
        resolvedAdapter: 'claude-code'
      }
    })

    const managedTaskManager = new TaskManager()
    await managedTaskManager.startTask({
      taskId: 'task-stop-waiting',
      description: 'trigger',
      adapter: 'claude-code',
      enableServerSync: true
    })

    const waitingTask = managedTaskManager.getTask('task-stop-waiting')
    expect(waitingTask?.status).toBe('waiting_input')
    expect(waitingTask?.session).toBeUndefined()
    expect(waitingTask?.pendingInteraction).toBeDefined()

    expect(managedTaskManager.stopTask('task-stop-waiting')).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 0))

    const stoppedTask = managedTaskManager.getTask('task-stop-waiting')
    expect(stoppedTask?.status).toBe('failed')
    expect(stoppedTask?.pendingInteraction).toBeUndefined()
    expect(stoppedTask?.logs).toContain('Task stopped by user')
    expect(mocks.postSessionEvent).toHaveBeenCalledWith('task-stop-waiting', {
      type: 'interaction_response',
      id: expect.stringContaining('task-recovery:task-stop-waiting:'),
      data: 'cancel'
    })
    expect(mocks.postSessionEvent).toHaveBeenCalledWith('task-stop-waiting', {
      type: 'error',
      data: {
        message: 'Task stopped by user',
        fatal: true
      }
    })
  })
})
