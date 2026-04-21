import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { resetConfigCache } from '@vibe-forge/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { acquireConfigWatchRuntime } from '#~/services/config/watch.js'
import { sessionSubscriberSockets } from '#~/services/session/runtime.js'

describe('config watch runtime', () => {
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = await mkdtemp(path.join(tmpdir(), 'vf-config-watch-'))
    sessionSubscriberSockets.clear()
    resetConfigCache()
  })

  afterEach(async () => {
    sessionSubscriberSockets.clear()
    resetConfigCache()
    await rm(workspaceDir, { recursive: true, force: true })
  })

  it('broadcasts config updates when a new project config file is created', async () => {
    const subscriberSocket = {
      readyState: 1,
      send: vi.fn()
    }
    sessionSubscriberSockets.add(subscriberSocket as any)

    const watcher = await acquireConfigWatchRuntime(workspaceDir)

    try {
      await writeFile(
        path.join(workspaceDir, '.ai.config.json'),
        '{ "general": { "interfaceLanguage": "en" } }\n',
        'utf8'
      )

      await vi.waitFor(() => {
        expect(subscriberSocket.send).toHaveBeenCalled()
      }, { timeout: 3000, interval: 50 })

      const payload = JSON.parse(String(subscriberSocket.send.mock.calls.at(-1)?.[0]))
      expect(payload).toMatchObject({
        type: 'config_updated',
        workspaceFolder: workspaceDir
      })
    } finally {
      watcher.release()
    }
  })

  it('broadcasts config updates when an extended config file changes', async () => {
    const baseConfigPath = path.join(workspaceDir, 'base.yaml')
    await writeFile(
      baseConfigPath,
      `
general:
  interfaceLanguage: zh
`,
      'utf8'
    )
    await writeFile(
      path.join(workspaceDir, '.ai.config.json'),
      JSON.stringify(
        {
          extend: './base.yaml'
        },
        null,
        2
      ),
      'utf8'
    )

    const subscriberSocket = {
      readyState: 1,
      send: vi.fn()
    }
    sessionSubscriberSockets.add(subscriberSocket as any)

    const watcher = await acquireConfigWatchRuntime(workspaceDir)

    try {
      await writeFile(
        baseConfigPath,
        `
general:
  interfaceLanguage: en
`,
        'utf8'
      )

      await vi.waitFor(() => {
        expect(subscriberSocket.send).toHaveBeenCalled()
      }, { timeout: 3000, interval: 50 })

      const payload = JSON.parse(String(subscriberSocket.send.mock.calls.at(-1)?.[0]))
      expect(payload).toMatchObject({
        type: 'config_updated',
        workspaceFolder: workspaceDir
      })
    } finally {
      watcher.release()
    }
  })
})
