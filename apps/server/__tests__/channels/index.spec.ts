import { z } from 'zod'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadChannelModule = vi.fn()
const handleInboundEvent = vi.fn()
const handleSessionEvent = vi.fn()
const resolveBinding = vi.fn()
const sendToolCallJsonFile = vi.fn()
const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

vi.mock('#~/channels/loader.js', () => ({
  loadChannelModule
}))

vi.mock('#~/channels/handlers.js', () => ({
  handleInboundEvent,
  handleSessionEvent
}))

vi.mock('#~/channels/state.js', () => ({
  resolveBinding
}))

vi.mock('#~/channels/tool-call-file.js', () => ({
  sendToolCallJsonFile
}))

vi.mock('#~/utils/logger.js', () => ({
  logger
}))

describe('initChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('logs connected channels after startReceiving succeeds', async () => {
    const startReceiving = vi.fn()

    loadChannelModule.mockReturnValue({
      definition: {
        configSchema: z.object({
          type: z.literal('lark'),
          appId: z.string()
        })
      },
      create: vi.fn().mockResolvedValue({
        startReceiving,
        close: vi.fn()
      })
    })

    const { initChannels } = await import('#~/channels/index.js')
    const manager = await initChannels([{
      channels: {
        'miniapp-gear': {
          type: 'lark',
          appId: 'cli_xxx'
        }
      }
    }])

    expect(startReceiving).toHaveBeenCalledOnce()
    expect(manager.states.get('miniapp-gear')).toMatchObject({
      key: 'miniapp-gear',
      type: 'lark',
      status: 'connected',
      configSource: 'project'
    })
    expect(logger.info).toHaveBeenCalledWith(
      {
        channelKey: 'miniapp-gear',
        channelType: 'lark',
        configSource: 'project'
      },
      '[channels] channel connected'
    )
  })

  it('logs validation failures instead of failing silently', async () => {
    loadChannelModule.mockReturnValue({
      definition: {
        configSchema: z.object({
          type: z.literal('lark'),
          appId: z.string()
        })
      },
      create: vi.fn()
    })

    const { initChannels } = await import('#~/channels/index.js')
    const manager = await initChannels([{
      channels: {
        'miniapp-gear': {
          type: 'lark'
        }
      }
    }])

    expect(manager.states.get('miniapp-gear')).toMatchObject({
      key: 'miniapp-gear',
      type: 'lark',
      status: 'error',
      configSource: 'project'
    })

    const [payload, message] = logger.error.mock.calls[0] ?? []
    expect(message).toBe('[channels] channel config validation failed')
    expect(payload).toEqual(expect.objectContaining({
      channelKey: 'miniapp-gear',
      channelType: 'lark',
      configSource: 'project'
    }))
    expect(typeof payload.error).toBe('string')
  })

  it('logs init failures and closes the partially created connection', async () => {
    const close = vi.fn()
    const startReceiving = vi.fn().mockRejectedValue(new Error('connection rejected'))

    loadChannelModule.mockReturnValue({
      definition: {
        configSchema: z.object({
          type: z.literal('lark'),
          appId: z.string()
        })
      },
      create: vi.fn().mockResolvedValue({
        startReceiving,
        close
      })
    })

    const { initChannels } = await import('#~/channels/index.js')
    const manager = await initChannels([{
      channels: {
        'miniapp-gear': {
          type: 'lark',
          appId: 'cli_xxx'
        }
      }
    }])

    expect(close).toHaveBeenCalledOnce()
    expect(manager.states.get('miniapp-gear')).toMatchObject({
      key: 'miniapp-gear',
      type: 'lark',
      status: 'error',
      error: 'connection rejected',
      configSource: 'project'
    })
    expect(logger.error).toHaveBeenCalledWith(
      {
        channelKey: 'miniapp-gear',
        channelType: 'lark',
        configSource: 'project',
        error: 'connection rejected'
      },
      '[channels] channel initialization failed'
    )
  })
})
