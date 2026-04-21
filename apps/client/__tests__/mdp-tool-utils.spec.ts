import { describe, expect, it } from 'vitest'

import {
  buildMdpRequestFields,
  extractMdpToolPayload,
  getMdpToolTarget,
  resolveMdpToolKind
} from '#~/components/chat/tools/plugin-mdp/mdp-tool-utils'

describe('mdp tool utils', () => {
  it('recognizes mdp tool names across adapter namespaces', () => {
    expect(resolveMdpToolKind('adapter:codex:mcp:MDP:listPaths')).toBe('listPaths')
    expect(resolveMdpToolKind('mcp__MDP__callPath')).toBe('callPath')
    expect(resolveMdpToolKind('MDP:listClients')).toBe('listClients')
    expect(resolveMdpToolKind('adapter:codex:mcp:ChromeDevtools:click')).toBeUndefined()
  })

  it('extracts structured mdp payloads from wrapped tool results', () => {
    expect(extractMdpToolPayload({
      structuredContent: {
        ok: true,
        data: { pathname: '/config' }
      }
    })).toEqual({
      ok: true,
      data: { pathname: '/config' }
    })

    expect(extractMdpToolPayload({
      content: [
        {
          type: 'text',
          text: '{"paths":[{"path":"/skill.md"}]}'
        }
      ]
    })).toEqual({
      paths: [{ path: '/skill.md' }]
    })
  })

  it('builds narrow request summaries for discovery and invoke calls', () => {
    expect(getMdpToolTarget('listPaths', {
      clientIds: ['default::browser'],
      search: 'sidebar'
    })).toBe('sidebar')

    expect(getMdpToolTarget('callPath', {
      method: 'POST',
      path: '/layout/sidebar/collapse'
    })).toBe('POST /layout/sidebar/collapse')

    const requestFields = buildMdpRequestFields({
      clientId: 'default::server',
      method: 'POST',
      path: '/sessions/create',
      body: { initialMessage: 'hello' }
    })

    expect(requestFields.inlineFields.map(field => field.fallbackLabel)).toEqual([
      'Method',
      'Path'
    ])
    expect(requestFields.lineFields.map(field => field.fallbackLabel)).toEqual(['Client'])
    expect(requestFields.blockFields.map(field => field.fallbackLabel)).toEqual([])
    expect(requestFields.hiddenBlockFields.map(field => field.fallbackLabel)).toEqual(['Body'])
  })

  it('hides default json content-type headers from mdp request details', () => {
    const requestFields = buildMdpRequestFields({
      method: 'POST',
      path: '/navigation/session/open',
      headers: {
        'content-type': 'application/json'
      },
      body: {
        sessionId: 'session-1'
      }
    })

    expect(requestFields.blockFields.map(field => field.fallbackLabel)).toEqual([])
    expect(requestFields.hiddenBlockFields.map(field => field.fallbackLabel)).toEqual(['Body', 'Headers'])
  })

  it('parses json string bodies for structured mdp request display', () => {
    const requestFields = buildMdpRequestFields({
      method: 'POST',
      path: '/navigation/session/open',
      body: '{"sessionId":"session-1","focus":true}'
    })

    expect(requestFields.hiddenBlockFields).toHaveLength(1)
    expect(requestFields.hiddenBlockFields[0]?.value).toEqual({
      sessionId: 'session-1',
      focus: true
    })
  })
})
