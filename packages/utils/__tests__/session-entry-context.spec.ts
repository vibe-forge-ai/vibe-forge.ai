import { describe, expect, it } from 'vitest'

import {
  buildSessionEntryContextSystemPrompt,
  normalizeSessionEntryContext,
  prependSessionEntryContextToMessageContent
} from '#~/session-entry-context.js'

describe('session entry context helpers', () => {
  it('normalizes browser entry context payloads', () => {
    expect(normalizeSessionEntryContext({
      kind: 'browser',
      page: 'config',
      route: '/config',
      search: '?tab=mdpTopology',
      href: 'http://localhost:5173/ui/config?tab=mdpTopology',
      activeSessionId: 'session-1',
      mdp: {
        refs: [
          {
            connectionKey: 'default',
            clientId: 'default::browser-1',
            rawClientId: 'browser-1'
          }
        ]
      }
    })).toEqual({
      kind: 'browser',
      page: 'config',
      route: '/config',
      search: '?tab=mdpTopology',
      href: 'http://localhost:5173/ui/config?tab=mdpTopology',
      activeSessionId: 'session-1',
      mdp: {
        refs: [
          {
            connectionKey: 'default',
            clientId: 'default::browser-1',
            rawClientId: 'browser-1'
          }
        ]
      }
    })
  })

  it('builds a browser system prompt with environment and mdp refs', () => {
    const prompt = buildSessionEntryContextSystemPrompt({
      kind: 'browser',
      page: 'config',
      route: '/config',
      search: '?tab=mdpTopology&source=user',
      activeSessionId: 'session-1',
      mdp: {
        refs: [
          {
            connectionKey: 'default',
            clientId: 'default::browser-1',
            rawClientId: 'browser-1'
          }
        ]
      }
    })

    expect(prompt).toContain('You are currently talking to the user through the Vibe Forge browser UI')
    expect(prompt).toContain('- route: /config')
    expect(prompt).toContain('- search: ?tab=mdpTopology&source=user')
    expect(prompt).toContain('default::browser-1')
  })

  it('prepends runtime context to a user turn without mutating original content', () => {
    const original = [{ type: 'text' as const, text: '帮我看一下当前页面' }]
    const next = prependSessionEntryContextToMessageContent(original, {
      kind: 'cli',
      sessionId: 'session-1',
      cwd: '/workspace/demo',
      outputFormat: 'text',
      pid: 1234,
      mdp: {
        refs: [
          {
            connectionKey: 'default',
            clientId: 'default::cli-1',
            rawClientId: 'cli-1'
          }
        ]
      }
    })

    expect(next).toHaveLength(2)
    expect(next[0]).toMatchObject({
      type: 'text'
    })
    expect((next[0] as { text: string }).text).toContain('The user sent this turn from the Vibe Forge CLI runtime.')
    expect((next[0] as { text: string }).text).toContain('default::cli-1')
    expect(next[1]).toEqual(original[0])
    expect(original).toEqual([{ type: 'text', text: '帮我看一下当前页面' }])
  })
})
