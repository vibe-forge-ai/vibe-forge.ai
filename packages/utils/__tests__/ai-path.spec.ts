import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PROJECT_AI_BASE_DIR,
  DEFAULT_PROJECT_AI_ENTITIES_DIR,
  resolveProjectAiBaseDirName,
  resolveProjectAiEntitiesDir,
  resolveProjectAiEntitiesDirName
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
})
