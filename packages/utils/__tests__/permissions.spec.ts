import { describe, expect, it } from 'vitest'

import { normalizePermissionToolName } from '#~/index.js'

describe('permission tool normalization', () => {
  it('normalizes MCP-style server and tool labels into stable permission keys', () => {
    expect(normalizePermissionToolName('MDP:listPaths')).toEqual({
      key: 'mcp-mdp-listpaths',
      label: 'MDP:listPaths',
      scope: 'tool'
    })
  })

  it('keeps bare MCP permission keys stable', () => {
    expect(normalizePermissionToolName('mcp-mdp-listpaths')).toEqual({
      key: 'mcp-mdp-listpaths',
      label: 'mcp-mdp-listpaths',
      scope: 'tool'
    })
  })
})
