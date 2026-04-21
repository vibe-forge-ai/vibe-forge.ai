import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MDP_LIST_CLIENTS_PERMISSION_NAME,
  DEFAULT_MDP_LIST_PATHS_PERMISSION_NAME,
  DEFAULT_MDP_READ_SKILL_PERMISSION_NAME,
  mergeDefaultMdpBridgePermissions,
  resolveUseDefaultMdpBridge
} from '#~/default-mdp-mcp.js'

describe('default MDP bridge permissions', () => {
  it('enables the built-in MDP bridge by default', () => {
    expect(resolveUseDefaultMdpBridge({})).toBe(true)
  })

  it('lets config disable the built-in MDP bridge permission injection', () => {
    expect(resolveUseDefaultMdpBridge({
      projectConfig: {
        mdp: {
          noDefaultBridge: true
        }
      }
    })).toBe(false)
  })

  it('adds listClients, listPaths, and read-only skill discovery allow by default when the built-in bridge is enabled', () => {
    const [projectConfig, userConfig] = mergeDefaultMdpBridgePermissions({
      projectConfig: {
        permissions: {
          allow: ['Read']
        }
      }
    })

    expect(DEFAULT_MDP_LIST_CLIENTS_PERMISSION_NAME).toBe('mcp-mdp-listclients')
    expect(DEFAULT_MDP_LIST_PATHS_PERMISSION_NAME).toBe('mcp-mdp-listpaths')
    expect(DEFAULT_MDP_READ_SKILL_PERMISSION_NAME).toBe('mcp-mdp-callpath-get-skill')
    expect(projectConfig?.permissions?.allow).toEqual([
      'Read',
      'mcp-mdp-listclients',
      'mcp-mdp-listpaths',
      'mcp-mdp-callpath-get-skill'
    ])
    expect(userConfig).toBeUndefined()
  })

  it('does not add default MDP discovery allow entries when the built-in bridge is disabled', () => {
    const [projectConfig] = mergeDefaultMdpBridgePermissions({
      projectConfig: {
        mdp: {
          noDefaultBridge: true
        },
        permissions: {
          allow: ['Read']
        }
      }
    })

    expect(projectConfig?.permissions?.allow).toEqual(['Read'])
  })
})
