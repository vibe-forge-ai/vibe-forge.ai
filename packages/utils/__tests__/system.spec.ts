import { describe, expect, it, vi } from 'vitest'
import { notify, notifyOptionsSchema } from '#~/system.js'

const notifierNotify = vi.hoisted(() => vi.fn())

vi.mock('node-notifier', () => ({
  default: {
    notify: notifierNotify
  }
}))

describe('system helpers', () => {
  it('exposes the notification schema', () => {
    expect(notifyOptionsSchema.parse({
      description: 'task completed'
    })).toEqual({
      description: 'task completed'
    })
  })

  it('calls node-notifier and resolves without confirmation by default', async () => {
    notifierNotify.mockImplementation((_options, callback) => {
      callback?.(null, 'unused', undefined)
    })

    const result = await notify({
      description: 'task completed',
      sound: false
    })

    expect(notifierNotify).toHaveBeenCalledOnce()
    expect(result.response).toBe('default')
    expect(result.metadata?.activationType).toBe('default')
  })
})
