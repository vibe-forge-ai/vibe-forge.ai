import { mkdir, mkdtemp, readFile, readlink, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { AdapterCtx } from '@vibe-forge/types'

import { prepareCodexSessionHome } from '#~/runtime/accounts.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('prepareCodexSessionHome', () => {
  it('links real home git config into the isolated Codex session home', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-codex-session-home-'))
    const realHome = join(workspace, 'real-home')
    const mockHome = join(workspace, '.ai', '.mock')
    tempDirs.push(workspace)

    await mkdir(join(realHome, '.config', 'git'), { recursive: true })
    await writeFile(join(realHome, '.gitconfig'), '[user]\n\tname = real\n')
    await writeFile(join(realHome, '.config', 'git', 'config'), '[alias]\n\tco = checkout\n')

    const result = await prepareCodexSessionHome({
      ctx: {
        cwd: workspace,
        env: {
          HOME: mockHome,
          __VF_PROJECT_REAL_HOME__: realHome
        },
        ctxId: 'ctx',
        configs: []
      },
      sessionId: 'session'
    })

    expect(await readlink(join(result.homeDir, '.gitconfig'))).toBe(join(realHome, '.gitconfig'))
    expect(await readlink(join(result.homeDir, '.config', 'git'))).toBe(join(realHome, '.config', 'git'))
  })

  it('shares Codex session storage across sessionIds via mockHome symlinks so resume can find prior rollouts', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-codex-session-share-'))
    const mockHome = join(workspace, '.ai', '.mock')
    tempDirs.push(workspace)

    const ctxBase: Pick<AdapterCtx, 'cwd' | 'env' | 'ctxId' | 'configs'> = {
      cwd: workspace,
      env: {
        HOME: mockHome
      },
      ctxId: 'ctx',
      configs: []
    }

    const first = await prepareCodexSessionHome({ ctx: ctxBase, sessionId: 'session-a' })
    const second = await prepareCodexSessionHome({ ctx: ctxBase, sessionId: 'session-b' })

    expect(first.homeDir).not.toBe(second.homeDir)

    const expectedSessionsDir = join(mockHome, '.codex', 'sessions')

    expect(await readlink(join(first.homeDir, '.codex', 'sessions'))).toBe(expectedSessionsDir)
    expect(await readlink(join(second.homeDir, '.codex', 'sessions'))).toBe(expectedSessionsDir)

    const sessionsStat = await stat(expectedSessionsDir)
    expect(sessionsStat.isDirectory()).toBe(true)

    const rolloutBytes = '{"event":"start"}\n'
    await writeFile(join(first.homeDir, '.codex', 'sessions', 'rollout.jsonl'), rolloutBytes)
    expect(await readFile(join(second.homeDir, '.codex', 'sessions', 'rollout.jsonl'), 'utf8')).toBe(rolloutBytes)
  })

  it('migrates legacy vf-owned Codex rollouts before replacing isolated session storage', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-codex-session-migrate-'))
    const mockHome = join(workspace, '.ai', '.mock')
    tempDirs.push(workspace)

    const legacyHome = join(workspace, '.ai', 'caches', 'ctx', 'session-a', 'adapter-codex-home')
    const legacyRollout = join(legacyHome, '.codex', 'sessions', 'rollout.jsonl')
    const rolloutBytes = '{"event":"legacy"}\n'
    await mkdir(join(legacyHome, '.codex', 'sessions'), { recursive: true })
    await writeFile(legacyRollout, rolloutBytes)

    const result = await prepareCodexSessionHome({
      ctx: {
        cwd: workspace,
        env: {
          HOME: mockHome
        },
        ctxId: 'ctx',
        configs: []
      },
      sessionId: 'session-a'
    })

    expect(await readFile(join(mockHome, '.codex', 'sessions', 'rollout.jsonl'), 'utf8')).toBe(rolloutBytes)
    expect(await readlink(join(result.homeDir, '.codex', 'sessions'))).toBe(join(mockHome, '.codex', 'sessions'))
  })
})
