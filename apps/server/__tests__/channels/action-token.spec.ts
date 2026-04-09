import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('channel action token', () => {
  let tempDir: string | undefined

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-action-token-'))
    vi.stubEnv('DB_PATH', path.join(tempDir, 'db.sqlite'))
  })

  afterEach(async () => {
    const { resetChannelActionTokenStateForTests } = await import('#~/channels/action-token.js')
    resetChannelActionTokenStateForTests()
    if (tempDir != null) {
      fs.rmSync(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
    vi.unstubAllEnvs()
    vi.useRealTimers()
    vi.resetModules()
  })

  it('creates verifiable action tokens with scoped claims', async () => {
    vi.stubEnv('__VF_PROJECT_AI_SERVER_ACTION_SECRET__', 'test-secret')
    const {
      createChannelActionToken,
      verifyChannelActionToken
    } = await import('#~/channels/action-token.js')

    const token = createChannelActionToken({
      action: 'tool-call-detail',
      sessionId: 'sess-1',
      sessionUrl: 'https://ui.example/session/sess-1?toolUseId=tool-1&messageId=msg-1',
      toolUseId: 'tool-1',
      messageId: 'msg-1'
    })
    const verified = verifyChannelActionToken(token, 'tool-call-detail')

    expect(verified).toEqual({
      ok: true,
      claims: expect.objectContaining({
        action: 'tool-call-detail',
        sessionId: 'sess-1',
        sessionUrl: 'https://ui.example/session/sess-1?toolUseId=tool-1&messageId=msg-1',
        toolUseId: 'tool-1',
        messageId: 'msg-1',
        oneTime: false
      })
    })
  })

  it('expires old tokens and prevents one-time token replay', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08T00:00:00.000Z'))
    vi.stubEnv('__VF_PROJECT_AI_SERVER_ACTION_SECRET__', 'test-secret')
    const {
      consumeChannelActionToken,
      createChannelActionToken,
      verifyChannelActionToken
    } = await import('#~/channels/action-token.js')

    const exportToken = createChannelActionToken({
      action: 'tool-call-export',
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      oneTime: true
    })

    expect(consumeChannelActionToken(exportToken, 'tool-call-export')).toEqual({
      ok: true,
      claims: expect.objectContaining({
        action: 'tool-call-export',
        sessionId: 'sess-1',
        toolUseId: 'tool-1',
        oneTime: true
      })
    })
    expect(consumeChannelActionToken(exportToken, 'tool-call-export')).toEqual({
      ok: false,
      code: 'replayed'
    })

    const expiringToken = createChannelActionToken({
      action: 'tool-call-detail',
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      ttlMs: 1
    })
    vi.advanceTimersByTime(2)

    expect(verifyChannelActionToken(expiringToken, 'tool-call-detail')).toEqual({
      ok: false,
      code: 'expired'
    })
  })

  it('persists one-time token consumption across module reloads', async () => {
    const dbPath = path.join(tempDir!, 'db.sqlite')

    vi.stubEnv('DB_PATH', dbPath)
    vi.stubEnv('__VF_PROJECT_AI_SERVER_ACTION_SECRET__', 'test-secret')
    let actionToken = await import('#~/channels/action-token.js')

    const token = actionToken.createChannelActionToken({
      action: 'tool-call-export',
      sessionId: 'sess-1',
      toolUseId: 'tool-1',
      oneTime: true
    })

    expect(actionToken.consumeChannelActionToken(token, 'tool-call-export')).toEqual({
      ok: true,
      claims: expect.objectContaining({
        action: 'tool-call-export',
        sessionId: 'sess-1',
        toolUseId: 'tool-1',
        oneTime: true
      })
    })

    vi.resetModules()
    vi.stubEnv('DB_PATH', dbPath)
    vi.stubEnv('__VF_PROJECT_AI_SERVER_ACTION_SECRET__', 'test-secret')
    actionToken = await import('#~/channels/action-token.js')

    expect(actionToken.consumeChannelActionToken(token, 'tool-call-export')).toEqual({
      ok: false,
      code: 'replayed'
    })
  })
})
