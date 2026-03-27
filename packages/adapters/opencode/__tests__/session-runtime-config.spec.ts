import { execFile, spawn } from 'node:child_process'
import { lstat, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { AdapterOutputEvent } from '@vibe-forge/core/adapter'

import { createOpenCodeSession } from '#~/runtime/session.js'

import {
  createWorkspace,
  flushAsyncWork,
  makeCtx,
  makeProc,
  mockExecFileJsonResponses,
  registerRuntimeTestHooks,
  writeDocument
} from './runtime-test-helpers'

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  execFile: vi.fn()
}))

const spawnMock = vi.mocked(spawn)
const execFileMock = vi.mocked(execFile)

describe('createOpenCodeSession runtime config', () => {
  registerRuntimeTestHooks()

  it('uses the built-in plan agent when permission mode is plan', async () => {
    mockExecFileJsonResponses(execFileMock, [
      { id: 'sess_plan', title: 'Vibe Forge:session-plan', updatedAt: '2026-03-26T00:00:00.000Z' }
    ])
    spawnMock.mockImplementation(() => makeProc({ stdout: 'planned\n' }))

    const events: AdapterOutputEvent[] = []
    const { ctx } = makeCtx()

    await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-plan',
      permissionMode: 'plan',
      description: 'Inspect only.',
      onEvent: (event: AdapterOutputEvent) => events.push(event)
    } as any)

    await flushAsyncWork()

    expect(spawnMock.mock.calls[0]?.[1]).toContain('plan')
    expect(events[0]).toMatchObject({
      type: 'init',
      data: {
        agents: ['plan']
      }
    })
  })

  it('applies default MCP include and exclude filters from config', async () => {
    mockExecFileJsonResponses(execFileMock, [
      { id: 'sess_mcp', title: 'Vibe Forge:session-mcp-defaults', updatedAt: '2026-03-26T00:00:00.000Z' }
    ])
    spawnMock.mockImplementation(() => makeProc({ stdout: 'mcp\n' }))

    const { ctx } = makeCtx({
      configs: [{
        mcpServers: {
          docs: { command: 'npx', args: ['docs-server'] },
          jira: { type: 'http', url: 'https://example.test/mcp' },
          browser: { command: 'npx', args: ['browser-server'] }
        },
        defaultIncludeMcpServers: ['docs', 'jira'],
        defaultExcludeMcpServers: ['jira']
      }, undefined]
    })

    await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-mcp-defaults',
      description: 'list docs',
      onEvent: () => {}
    } as any)

    await flushAsyncWork()

    const spawnOptions = spawnMock.mock.calls[0]?.[2] as { env?: Record<string, string> }
    const configDir = spawnOptions.env?.OPENCODE_CONFIG_DIR
    const inlineConfig = JSON.parse(
      configDir ? await readFile(join(configDir, 'opencode.json'), 'utf8') : '{}'
    ) as {
      mcp?: Record<string, unknown>
    }

    expect(Object.keys(inlineConfig.mcp ?? {})).toEqual(['docs'])
  })

  it('filters nullish adapter env values before spawning opencode', async () => {
    mockExecFileJsonResponses(execFileMock, [
      { id: 'sess_env', title: 'Vibe Forge:session-env', updatedAt: '2026-03-26T00:00:00.000Z' }
    ])
    spawnMock.mockImplementation(() => makeProc({ stdout: 'env\n' }))

    const { ctx } = makeCtx({
      env: {
        KEEP_ME: 'yes',
        DROP_ME: null,
        DROP_ME_TOO: undefined
      }
    })

    await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-env',
      description: 'env',
      onEvent: () => {}
    } as any)

    await flushAsyncWork()

    const childEnv = (spawnMock.mock.calls[0]?.[2] as { env?: Record<string, string> }).env ?? {}
    expect(childEnv.KEEP_ME).toBe('yes')
    expect('DROP_ME' in childEnv).toBe(false)
    expect('DROP_ME_TOO' in childEnv).toBe(false)
  })

  it('bridges Vibe Forge skills into OPENCODE_CONFIG_DIR for the skill tool', async () => {
    const workspace = await createWorkspace()
    await writeDocument(
      join(workspace, '.ai/skills/research/SKILL.md'),
      '---\nname: research\ndescription: 检索资料\n---\n阅读 README.md'
    )
    await writeDocument(
      join(workspace, '.ai/skills/review/SKILL.md'),
      '---\nname: review\ndescription: 代码评审\n---\n检查风险'
    )
    mockExecFileJsonResponses(execFileMock, [
      { id: 'sess_skill', title: 'Vibe Forge:session-skill-bridge', updatedAt: '2026-03-26T00:00:00.000Z' }
    ])
    spawnMock.mockImplementation(() => makeProc({ stdout: 'skills\n' }))

    const { ctx } = makeCtx({ cwd: workspace })
    await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-skill-bridge',
      description: 'list skills',
      skills: {
        include: ['research'],
        exclude: ['review']
      },
      onEvent: () => {}
    } as any)

    await flushAsyncWork()

    const configDir = (spawnMock.mock.calls[0]?.[2] as { env?: Record<string, string> }).env?.OPENCODE_CONFIG_DIR
    expect(typeof configDir).toBe('string')
    expect((await lstat(join(configDir!, 'skills', 'research'))).isSymbolicLink()).toBe(true)
    await expect(lstat(join(configDir!, 'skills', 'review'))).rejects.toThrow()
  })

  it('merges base opencode.json into the session config without mutating the source file', async () => {
    const workspace = await createWorkspace()
    const baseConfigDir = join(workspace, 'user-opencode-config')
    await writeDocument(
      join(baseConfigDir, 'opencode.json'),
      JSON.stringify(
        {
          instructions: ['base-instructions.md'],
          theme: 'ocean',
          nested: {
            keep: true
          }
        },
        null,
        2
      )
    )
    mockExecFileJsonResponses(execFileMock, [
      { id: 'sess_merge', title: 'Vibe Forge:session-merge', updatedAt: '2026-03-26T00:00:00.000Z' }
    ])
    spawnMock.mockImplementation(() => makeProc({ stdout: 'merged\n' }))

    const { ctx } = makeCtx({
      cwd: workspace,
      env: {
        OPENCODE_CONFIG_DIR: baseConfigDir
      }
    })

    await createOpenCodeSession(ctx, {
      type: 'create',
      runtime: 'server',
      sessionId: 'session-merge',
      description: 'merge config',
      onEvent: () => {}
    } as any)

    await flushAsyncWork()

    const spawnOptions = spawnMock.mock.calls[0]?.[2] as { env?: Record<string, string> }
    const configDir = spawnOptions.env?.OPENCODE_CONFIG_DIR
    const sessionConfig = JSON.parse(
      configDir ? await readFile(join(configDir, 'opencode.json'), 'utf8') : '{}'
    ) as {
      instructions?: string[]
      theme?: string
      nested?: Record<string, unknown>
    }
    const sourceConfig = JSON.parse(
      await readFile(join(baseConfigDir, 'opencode.json'), 'utf8')
    ) as {
      instructions?: string[]
      theme?: string
      nested?: Record<string, unknown>
    }

    expect(sessionConfig.instructions).toContain('base-instructions.md')
    expect(sessionConfig.theme).toBe('ocean')
    expect(sessionConfig.nested).toMatchObject({ keep: true })
    expect(sourceConfig).toEqual({
      instructions: ['base-instructions.md'],
      theme: 'ocean',
      nested: {
        keep: true
      }
    })
  })
})
