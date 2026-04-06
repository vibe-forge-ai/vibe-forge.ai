import { describe, expect, it } from 'vitest'

import type { WorkspaceAssetBundle } from '@vibe-forge/types'

import { resolveSelectedMcpNames } from '#~/selection-internal.js'

const createBundle = (): WorkspaceAssetBundle => ({
  cwd: '/tmp/workspace',
  pluginConfigs: [],
  pluginInstances: [],
  assets: [],
  rules: [],
  specs: [],
  entities: [],
  skills: [],
  hookPlugins: [],
  opencodeOverlayAssets: [],
  defaultIncludeMcpServers: [],
  defaultExcludeMcpServers: ['TypeScriptLanguageService'],
  mcpServers: {
    TypeScriptLanguageService: {
      kind: 'mcpServer',
      id: 'mcp:TypeScriptLanguageService',
      scope: 'workspace',
      name: 'TypeScriptLanguageService',
      displayName: 'TypeScriptLanguageService',
      source: '/tmp/workspace/.ai.config.json',
      command: 'node',
      args: ['tslspmcp']
    }
  }
})

describe('resolveSelectedMcpNames', () => {
  it('lets an explicit include override default excludes', () => {
    const selected = resolveSelectedMcpNames(createBundle(), {
      include: ['TypeScriptLanguageService']
    })

    expect(selected).toEqual(['TypeScriptLanguageService'])
  })
})
