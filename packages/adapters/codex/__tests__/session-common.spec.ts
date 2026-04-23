import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { buildThreadCacheKey } from '#~/runtime/session-common.js'

const makeBaseParams = (authPath: string) => ({
  cwd: '/tmp/workspace',
  useYolo: false,
  approvalPolicy: 'never' as const,
  sandboxPolicy: {
    type: 'workspaceWrite' as const
  },
  resolvedModel: 'gpt-5.4',
  authPath,
  configFingerprintArgs: ['-c', 'model_reasoning_effort="high"'],
  features: {
    codex_hooks: true
  }
})

describe('buildThreadCacheKey', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })))
    tempDirs.length = 0
  })

  it('stays stable when auth tokens refresh but account identity stays the same', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vf-codex-thread-key-'))
    tempDirs.push(dir)
    const authPath = join(dir, 'auth.json')

    await writeFile(authPath, JSON.stringify({
      auth_mode: 'chatgpt',
      tokens: {
        account_id: 'acct-stable',
        access_token: 'token-a',
        refresh_token: 'refresh-a'
      }
    }))

    const keyA = await buildThreadCacheKey(makeBaseParams(authPath))

    await writeFile(authPath, JSON.stringify({
      auth_mode: 'chatgpt',
      tokens: {
        account_id: 'acct-stable',
        access_token: 'token-b',
        refresh_token: 'refresh-b'
      }
    }))

    const keyB = await buildThreadCacheKey(makeBaseParams(authPath))

    expect(keyB).toBe(keyA)
  })

  it('changes when the resolved account identity changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vf-codex-thread-key-'))
    tempDirs.push(dir)
    const authPath = join(dir, 'auth.json')

    await writeFile(authPath, JSON.stringify({
      auth_mode: 'chatgpt',
      tokens: {
        account_id: 'acct-a',
        access_token: 'token-a'
      }
    }))

    const keyA = await buildThreadCacheKey(makeBaseParams(authPath))

    await writeFile(authPath, JSON.stringify({
      auth_mode: 'chatgpt',
      tokens: {
        account_id: 'acct-b',
        access_token: 'token-b'
      }
    }))

    const keyB = await buildThreadCacheKey(makeBaseParams(authPath))

    expect(keyB).not.toBe(keyA)
  })

  it('falls back to the auth digest when auth mode is the only identity signal', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vf-codex-thread-key-'))
    tempDirs.push(dir)
    const authPath = join(dir, 'auth.json')

    await writeFile(authPath, JSON.stringify({
      auth_mode: 'api_key',
      tokens: {
        access_token: 'token-a'
      }
    }))

    const keyA = await buildThreadCacheKey(makeBaseParams(authPath))

    await writeFile(authPath, JSON.stringify({
      auth_mode: 'api_key',
      tokens: {
        access_token: 'token-b'
      }
    }))

    const keyB = await buildThreadCacheKey(makeBaseParams(authPath))

    expect(keyB).not.toBe(keyA)
  })

  it('still falls back to auth content digest when no stable identity is available', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vf-codex-thread-key-'))
    tempDirs.push(dir)
    const authPath = join(dir, 'auth.json')

    await writeFile(authPath, JSON.stringify({
      tokens: {
        access_token: 'token-a'
      }
    }))

    const keyA = await buildThreadCacheKey(makeBaseParams(authPath))

    await writeFile(authPath, JSON.stringify({
      tokens: {
        access_token: 'token-b'
      }
    }))

    const keyB = await buildThreadCacheKey(makeBaseParams(authPath))

    expect(keyB).not.toBe(keyA)
  })
})
