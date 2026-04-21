import { describe, expect, it } from 'vitest'

import { normalizePermissionToolName, resolvePermissionToolContext } from '#~/index.js'

describe('permission tool normalization', () => {
  it('normalizes MCP-style server and tool labels into stable permission keys', () => {
    expect(normalizePermissionToolName('MDP:listClients')).toEqual({
      key: 'mcp-mdp-listclients',
      label: 'MDP:listClients',
      scope: 'tool'
    })

    expect(normalizePermissionToolName('MDP:listPaths')).toEqual({
      key: 'mcp-mdp-listpaths',
      label: 'MDP:listPaths',
      scope: 'tool'
    })
  })

  it('keeps bare MCP permission keys stable', () => {
    expect(normalizePermissionToolName('mcp-mdp-listclients')).toEqual({
      key: 'mcp-mdp-listclients',
      label: 'mcp-mdp-listclients',
      scope: 'tool'
    })

    expect(normalizePermissionToolName('mcp-mdp-listpaths')).toEqual({
      key: 'mcp-mdp-listpaths',
      label: 'mcp-mdp-listpaths',
      scope: 'tool'
    })
  })

  it('derives scoped lookup keys for read-only MDP skill discovery calls', () => {
    expect(resolvePermissionToolContext('MDP:callPath', {
      toolInput: {
        method: 'GET',
        path: '/sessions/skill.md'
      }
    })).toEqual({
      subject: {
        key: 'mcp-mdp-callpath',
        label: 'MDP:callPath',
        scope: 'tool'
      },
      lookupKeys: [
        'mcp-mdp-callpath-get',
        'mcp-mdp-callpath-get-skill'
      ]
    })
  })
})
