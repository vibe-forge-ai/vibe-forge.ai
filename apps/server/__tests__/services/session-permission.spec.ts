import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyPermissionInteractionDecision,
  resolvePermissionDecision,
  resolvePermissionContextFromInput,
  syncPermissionStateMirror
} from '#~/services/session/permission.js'
import { createEmptySessionPermissionState } from '@vibe-forge/utils'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  loadConfigState: vi.fn(),
  resolveSessionWorkspaceFolder: vi.fn(),
  updateConfigFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  getSessionLogger: vi.fn()
}))

vi.mock('#~/db/index.js', () => ({
  getDb: mocks.getDb
}))

vi.mock('#~/services/config/index.js', () => ({
  loadConfigState: mocks.loadConfigState
}))

vi.mock('#~/services/session/workspace.js', () => ({
  resolveSessionWorkspaceFolder: mocks.resolveSessionWorkspaceFolder
}))

vi.mock('@vibe-forge/config', () => ({
  buildConfigSections: (config: unknown) => ({
    general: config
  }),
  updateConfigFile: mocks.updateConfigFile
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile
}))

vi.mock('#~/utils/logger.js', () => ({
  getSessionLogger: mocks.getSessionLogger
}))

describe('session permission service', () => {
  let runtimeState: ReturnType<typeof createEmptySessionPermissionState>
  let projectConfig: { permissions: { allow: string[]; deny: string[]; ask: string[] } }
  const updateSessionRuntimeState = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    runtimeState = createEmptySessionPermissionState()
    projectConfig = {
      permissions: {
        allow: [],
        deny: [],
        ask: []
      }
    }

    updateSessionRuntimeState.mockImplementation(
      (_sessionId: string, updates: { permissionState?: typeof runtimeState }) => {
        if (updates.permissionState != null) {
          runtimeState = updates.permissionState
        }
      }
    )

    mocks.getDb.mockReturnValue({
      getSessionRuntimeState: vi.fn(() => ({
        runtimeKind: 'interactive',
        historySeedPending: false,
        permissionState: runtimeState
      })),
      updateSessionRuntimeState,
      getSession: vi.fn(() => ({
        id: 'sess-1',
        adapter: 'claude-code'
      }))
    })

    mocks.resolveSessionWorkspaceFolder.mockResolvedValue('/workspace')
    mocks.loadConfigState.mockImplementation(async () => ({
      workspaceFolder: '/workspace',
      projectConfig,
      mergedConfig: projectConfig
    }))
    mocks.updateConfigFile.mockImplementation(
      async ({ value }: { value: { permissions?: typeof projectConfig.permissions } }) => {
        if (value.permissions != null) {
          projectConfig = {
            permissions: {
              allow: [...(value.permissions.allow ?? [])],
              deny: [...(value.permissions.deny ?? [])],
              ask: [...(value.permissions.ask ?? [])]
            }
          }
        }
        return { ok: true }
      }
    )
    mocks.mkdir.mockResolvedValue(undefined)
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.getSessionLogger.mockReturnValue({
      warn: vi.fn()
    })
  })

  it('consumes one-shot deny before any other remembered decision', async () => {
    runtimeState = {
      allow: ['Write'],
      deny: ['Write'],
      onceAllow: ['Write'],
      onceDeny: ['Write']
    }

    const result = await resolvePermissionDecision({
      sessionId: 'sess-1',
      subject: {
        key: 'Write',
        label: 'Write',
        scope: 'tool'
      }
    })

    expect(result).toEqual(expect.objectContaining({
      result: 'deny',
      source: 'onceDeny'
    }))
    expect(runtimeState.onceDeny).toEqual([])
    expect(runtimeState.onceAllow).toEqual(['Write'])
  })

  it('consumes one-shot allow and leaves later session rules intact', async () => {
    runtimeState = {
      allow: ['Write'],
      deny: [],
      onceAllow: ['Write'],
      onceDeny: []
    }

    const result = await resolvePermissionDecision({
      sessionId: 'sess-1',
      subject: {
        key: 'Write',
        label: 'Write',
        scope: 'tool'
      }
    })

    expect(result).toEqual(expect.objectContaining({
      result: 'allow',
      source: 'onceAllow'
    }))
    expect(runtimeState.onceAllow).toEqual([])
    expect(runtimeState.allow).toEqual(['Write'])
  })

  it('falls back to project ask when the session does not override the tool', async () => {
    projectConfig.permissions.ask = ['Write']

    const result = await resolvePermissionDecision({
      sessionId: 'sess-1',
      subject: {
        key: 'Write',
        label: 'Write',
        scope: 'tool'
      }
    })

    expect(result).toEqual(expect.objectContaining({
      result: 'ask',
      source: 'projectAsk'
    }))
  })

  it('normalizes mixed-case custom tool keys before resolving remembered decisions', async () => {
    runtimeState = {
      allow: ['Channel-lark-test'],
      deny: [],
      onceAllow: [],
      onceDeny: []
    }

    const result = await resolvePermissionDecision({
      sessionId: 'sess-1',
      subject: {
        key: 'channel-lark-test',
        label: 'channel-lark-test',
        scope: 'tool'
      }
    })

    expect(result).toEqual(expect.objectContaining({
      result: 'allow',
      source: 'sessionAllow'
    }))
  })

  it('matches stored built-in MCP tool decisions across both known Codex subject slugs', async () => {
    runtimeState = {
      allow: ['mcp-vibeforge-list-tasks'],
      deny: [],
      onceAllow: [],
      onceDeny: []
    }

    const result = await resolvePermissionDecision({
      sessionId: 'sess-1',
      subject: {
        key: 'mcp-vibe-forge-list-tasks',
        label: 'VibeForge:List Tasks',
        scope: 'tool'
      },
      lookupKeys: ['mcp-vibeforge-list-tasks']
    })

    expect(result).toEqual(expect.objectContaining({
      result: 'allow',
      source: 'sessionAllow'
    }))
  })

  it('prefers deny over allow when built-in MCP alias keys disagree', async () => {
    runtimeState = {
      allow: ['mcp-vibeforge-list-tasks'],
      deny: ['mcp-vibe-forge-list-tasks'],
      onceAllow: [],
      onceDeny: []
    }

    const result = await resolvePermissionDecision({
      sessionId: 'sess-1',
      subject: {
        key: 'mcp-vibe-forge-list-tasks',
        label: 'VibeForge:List Tasks',
        scope: 'tool'
      },
      lookupKeys: ['mcp-vibeforge-list-tasks']
    })

    expect(result).toEqual(expect.objectContaining({
      result: 'deny',
      source: 'sessionDeny'
    }))
  })

  it('falls back to the built-in MCP server permission for Codex MCP approvals', async () => {
    projectConfig.permissions.allow = ['VibeForge']

    const result = await resolvePermissionDecision({
      sessionId: 'sess-1',
      subject: {
        key: 'mcp-vibe-forge-list-tasks',
        label: 'VibeForge:List Tasks',
        scope: 'tool'
      },
      lookupKeys: ['mcp-vibeforge-list-tasks', 'VibeForge']
    })

    expect(result).toEqual(expect.objectContaining({
      result: 'allow',
      source: 'projectAllow'
    }))
  })

  it('allows read-only MDP skill discovery through scoped lookup keys', async () => {
    projectConfig.permissions.allow = ['mcp-mdp-callpath-get-skill']

    const { subject, lookupKeys } = resolvePermissionContextFromInput({
      toolName: 'MDP:callPath',
      toolInput: {
        method: 'GET',
        path: '/sessions/skill.md'
      }
    })

    const result = await resolvePermissionDecision({
      sessionId: 'sess-1',
      subject,
      lookupKeys
    })

    expect(lookupKeys).toEqual([
      'mcp-mdp-callpath-get',
      'mcp-mdp-callpath-get-skill'
    ])
    expect(result).toEqual(expect.objectContaining({
      result: 'allow',
      source: 'projectAllow'
    }))
  })

  it('keeps the DB permission state authoritative when mirror sync fails', async () => {
    runtimeState = {
      allow: [],
      deny: [],
      onceAllow: ['Write'],
      onceDeny: []
    }
    mocks.writeFile.mockRejectedValueOnce(new Error('disk full'))

    const result = await resolvePermissionDecision({
      sessionId: 'sess-1',
      subject: {
        key: 'Write',
        label: 'Write',
        scope: 'tool'
      }
    })

    expect(result).toEqual(expect.objectContaining({
      result: 'allow',
      source: 'onceAllow'
    }))
    expect(runtimeState.onceAllow).toEqual([])
    expect(mocks.getSessionLogger).toHaveBeenCalledWith('sess-1', 'server')
  })

  it('writes permission mirror files for Kimi sessions', async () => {
    runtimeState = {
      allow: ['Shell'],
      deny: [],
      onceAllow: [],
      onceDeny: []
    }
    mocks.getDb.mockReturnValue({
      getSessionRuntimeState: vi.fn(() => ({
        runtimeKind: 'interactive',
        historySeedPending: false,
        permissionState: runtimeState
      })),
      updateSessionRuntimeState,
      getSession: vi.fn(() => ({
        id: 'sess-kimi',
        adapter: 'kimi'
      }))
    })

    await syncPermissionStateMirror('sess-kimi')

    const mirrorContent = String(mocks.writeFile.mock.calls.at(-1)?.[1] ?? '{}')
    expect(JSON.parse(mirrorContent)).toMatchObject({
      sessionId: 'sess-kimi',
      adapter: 'kimi',
      permissionState: {
        allow: ['Bash']
      }
    })
  })

  it('writes allow_project into project config and removes conflicting managed keys', async () => {
    runtimeState = {
      allow: [],
      deny: ['Write'],
      onceAllow: ['Write'],
      onceDeny: ['Write']
    }
    projectConfig.permissions = {
      allow: ['Read', 'Bash:*'],
      deny: ['Write'],
      ask: ['Write', 'Edit']
    }

    await applyPermissionInteractionDecision({
      sessionId: 'sess-1',
      subjectKeys: ['Write'],
      action: 'allow_project'
    })

    expect(projectConfig.permissions).toEqual({
      allow: ['Read', 'Bash:*', 'Write'],
      deny: [],
      ask: ['Edit']
    })
    expect(runtimeState).toEqual({
      allow: ['Write'],
      deny: [],
      onceAllow: [],
      onceDeny: []
    })
  })

  it('stores custom MCP subject keys in canonical lowercase form', async () => {
    runtimeState = {
      allow: [],
      deny: [],
      onceAllow: [],
      onceDeny: []
    }
    projectConfig.permissions = {
      allow: ['Channel-lark-test'],
      deny: [],
      ask: []
    }

    await applyPermissionInteractionDecision({
      sessionId: 'sess-1',
      subjectKeys: ['Channel-lark-test'],
      action: 'allow_project'
    })

    expect(projectConfig.permissions).toEqual({
      allow: ['channel-lark-test'],
      deny: [],
      ask: []
    })
    expect(runtimeState).toEqual({
      allow: ['channel-lark-test'],
      deny: [],
      onceAllow: [],
      onceDeny: []
    })
  })

  it('writes deny_project into project config and removes conflicting session allowances', async () => {
    runtimeState = {
      allow: ['Write'],
      deny: [],
      onceAllow: ['Write'],
      onceDeny: ['Write']
    }
    projectConfig.permissions = {
      allow: ['Write', 'Read'],
      deny: ['Bash:*'],
      ask: ['Write']
    }

    await applyPermissionInteractionDecision({
      sessionId: 'sess-1',
      subjectKeys: ['Write'],
      action: 'deny_project'
    })

    expect(projectConfig.permissions).toEqual({
      allow: ['Read'],
      deny: ['Bash:*', 'Write'],
      ask: []
    })
    expect(runtimeState).toEqual({
      allow: [],
      deny: ['Write'],
      onceAllow: [],
      onceDeny: []
    })
  })

  it('records deny_session without mutating project config', async () => {
    runtimeState = {
      allow: ['Write'],
      deny: [],
      onceAllow: ['Write'],
      onceDeny: []
    }
    projectConfig.permissions = {
      allow: ['Read'],
      deny: ['Bash'],
      ask: []
    }

    await applyPermissionInteractionDecision({
      sessionId: 'sess-1',
      subjectKeys: ['Write'],
      action: 'deny_session'
    })

    expect(projectConfig.permissions).toEqual({
      allow: ['Read'],
      deny: ['Bash'],
      ask: []
    })
    expect(runtimeState).toEqual({
      allow: [],
      deny: ['Write'],
      onceAllow: [],
      onceDeny: []
    })
  })
})
