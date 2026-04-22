import { Command } from 'commander'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registerAccountsCommand } from '#~/commands/accounts.js'

const mocks = vi.hoisted(() => ({
  buildConfigJsonVariables: vi.fn(() => ({})),
  loadConfig: vi.fn(),
  loadAdapter: vi.fn()
}))

vi.mock('@vibe-forge/config', () => ({
  buildConfigJsonVariables: mocks.buildConfigJsonVariables,
  loadConfig: mocks.loadConfig
}))

vi.mock('@vibe-forge/types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vibe-forge/types')>()
  return {
    ...actual,
    loadAdapter: mocks.loadAdapter
  }
})

const tempDirs: string[] = []
const originalCwd = process.cwd()

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  process.chdir(originalCwd)
  delete process.env.__VF_PROJECT_WORKSPACE_FOLDER__
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('accounts command', () => {
  it('stores adapter account artifacts returned by the add action', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'vf-accounts-command-'))
    tempDirs.push(cwd)
    process.chdir(cwd)

    mocks.loadConfig.mockResolvedValue([{}, {}])
    mocks.loadAdapter.mockResolvedValue({
      manageAccount: vi.fn().mockResolvedValue({
        accountKey: 'work',
        artifacts: [
          { path: 'auth.json', content: '{"token":"demo"}\n' },
          { path: 'meta.json', content: '{"title":"Work"}\n' }
        ],
        account: {
          key: 'work',
          title: 'Work',
          status: 'ready'
        },
        message: 'Connected account.'
      }),
      getAccountDetail: vi.fn().mockResolvedValue({
        account: {
          key: 'work',
          title: 'Work',
          status: 'ready',
          quota: {
            summary: 'Plan: Pro'
          }
        }
      })
    })

    const program = new Command()
    registerAccountsCommand(program)
    await program.parseAsync(['accounts', 'add', 'codex', 'work'], { from: 'user' })

    await expect(
      readFile(path.join(cwd, '.ai', '.local', 'adapters', 'codex', 'accounts', 'work', 'auth.json'), 'utf8')
    ).resolves.toBe('{"token":"demo"}\n')
  })

  it('removes the stored account directory when the adapter remove action asks for it', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'vf-accounts-command-'))
    tempDirs.push(cwd)
    process.chdir(cwd)

    const accountDir = path.join(cwd, '.ai', '.local', 'adapters', 'codex', 'accounts', 'work')
    await mkdir(accountDir, { recursive: true })
    await writeFile(path.join(accountDir, 'auth.json'), '{}\n')

    mocks.loadConfig.mockResolvedValue([{}, {}])
    mocks.loadAdapter.mockResolvedValue({
      manageAccount: vi.fn().mockResolvedValue({
        accountKey: 'work',
        removeStoredAccount: true,
        message: 'Removed account.'
      })
    })

    const program = new Command()
    registerAccountsCommand(program)
    await program.parseAsync(['accounts', 'remove', 'codex', 'work'], { from: 'user' })

    await expect(readFile(path.join(accountDir, 'auth.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
