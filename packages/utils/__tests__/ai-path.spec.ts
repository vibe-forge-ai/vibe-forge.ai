import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PROJECT_AI_BASE_DIR,
  DEFAULT_PROJECT_AI_ENTITIES_DIR,
  PROJECT_PRIMARY_WORKSPACE_FOLDER_ENV,
  resolvePrimaryWorkspaceFolder,
  resolveProjectAiBaseDirName,
  resolveProjectAiEntitiesDir,
  resolveProjectAiEntitiesDirName,
  resolveProjectConfigDir,
  resolveProjectMockHome
} from '#~/ai-path.js'

describe('ai path utils', () => {
  it('uses the default base dir and entities dir names', () => {
    expect(resolveProjectAiBaseDirName({})).toBe(DEFAULT_PROJECT_AI_BASE_DIR)
    expect(resolveProjectAiEntitiesDirName({})).toBe(DEFAULT_PROJECT_AI_ENTITIES_DIR)
  })

  it('resolves the entities dir under the env-configured ai base dir', () => {
    expect(resolveProjectAiEntitiesDir('/tmp/project', {
      __VF_PROJECT_AI_BASE_DIR__: '.vf',
      __VF_PROJECT_AI_ENTITIES_DIR__: 'agents'
    })).toBe('/tmp/project/.vf/agents')
  })

  it('supports nested entities dir paths', () => {
    expect(resolveProjectAiEntitiesDir('/tmp/project', {
      __VF_PROJECT_AI_ENTITIES_DIR__: 'knowledge/entities'
    })).toBe('/tmp/project/.ai/knowledge/entities')
  })

  it('resolves relative AI and config paths from the launch cwd', () => {
    expect(resolveProjectAiEntitiesDir('/tmp/project/c/d/e', {
      __VF_PROJECT_LAUNCH_CWD__: '/tmp/project/c/d/e',
      __VF_PROJECT_WORKSPACE_FOLDER__: '../../..',
      __VF_PROJECT_AI_BASE_DIR__: '.iac/ai',
      __VF_PROJECT_AI_ENTITIES_DIR__: 'agents'
    })).toBe('/tmp/project/c/d/e/.iac/ai/agents')

    expect(resolveProjectConfigDir('/tmp/project/c/d/e', {
      __VF_PROJECT_LAUNCH_CWD__: '/tmp/project/c/d/e',
      __VF_PROJECT_CONFIG_DIR__: '.'
    })).toBe('/tmp/project/c/d/e')
  })

  it('resolves the primary workspace from the explicit worktree override env', () => {
    expect(resolvePrimaryWorkspaceFolder('/tmp/worktrees/feature/project', {
      [PROJECT_PRIMARY_WORKSPACE_FOLDER_ENV]: '/tmp/project'
    })).toBe('/tmp/project')

    expect(resolvePrimaryWorkspaceFolder('/tmp/project', {
      [PROJECT_PRIMARY_WORKSPACE_FOLDER_ENV]: '/tmp/project'
    })).toBeUndefined()
  })

  it('falls back to the managed mock home when HOME points inside the workspace', () => {
    expect(resolveProjectMockHome('/tmp/project', {
      HOME: '/tmp/project',
      __VF_PROJECT_REAL_HOME__: '/tmp/home'
    })).toBe('/tmp/project/.ai/.mock')

    expect(resolveProjectMockHome('/tmp/project', {
      HOME: '/tmp/project/.codex',
      __VF_PROJECT_REAL_HOME__: '/tmp/home'
    })).toBe('/tmp/project/.ai/.mock')
  })

  it('keeps an explicit external HOME when it does not target the real home or workspace', () => {
    expect(resolveProjectMockHome('/tmp/project', {
      HOME: '/tmp/custom-home',
      __VF_PROJECT_REAL_HOME__: '/tmp/home'
    })).toBe('/tmp/custom-home')
  })
})
