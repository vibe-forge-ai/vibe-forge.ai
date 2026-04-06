import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyPermissionInteractionDecision,
  resolvePermissionDecision
} from '#~/services/session/permission.js'
import { createEmptySessionPermissionState } from '@vibe-forge/utils'

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  loadConfigState: vi.fn(),
  getWorkspaceFolder: vi.fn(),
  updateConfigFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('#~/db/index.js', () => ({
  getDb: mocks.getDb
}))

vi.mock('#~/services/config/index.js', () => ({
  loadConfigState: mocks.loadConfigState,
  getWorkspaceFolder: mocks.getWorkspaceFolder
}))

vi.mock('@vibe-forge/config', () => ({
  updateConfigFile: mocks.updateConfigFile
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile
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

    updateSessionRuntimeState.mockImplementation((_sessionId: string, updates: { permissionState?: typeof runtimeState }) => {
      if (updates.permissionState != null) {
        runtimeState = updates.permissionState
      }
    })

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

    mocks.getWorkspaceFolder.mockReturnValue('/workspace')
    mocks.loadConfigState.mockImplementation(async () => ({
      workspaceFolder: '/workspace',
      projectConfig,
      mergedConfig: projectConfig
    }))
    mocks.updateConfigFile.mockImplementation(async ({ value }: { value: { permissions?: typeof projectConfig.permissions } }) => {
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
    })
    mocks.mkdir.mockResolvedValue(undefined)
    mocks.writeFile.mockResolvedValue(undefined)
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
