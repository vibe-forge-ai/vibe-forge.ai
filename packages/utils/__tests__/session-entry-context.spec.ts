import { describe, expect, it } from 'vitest'

import {
  buildSessionEntryContextSystemPrompt,
  buildSessionEntryContextTurnPrompt,
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
    expect(prompt).toContain('MDP usage rules:')
    expect(prompt).toContain('always try MDP before ChromeDevtools')
    expect(prompt).toContain('Use ChromeDevtools only as a fallback')
    expect(prompt).toContain('preferred browser MDP client is only for browser-owned UI actions')
    expect(prompt).toContain('switch to the `Vibe Forge Server` MDP client')
    expect(prompt).toContain('Do not fall back to Bash, curl, or ad-hoc HTTP probing')
    expect(prompt).toContain('identify the relevant client first with `MDP.listClients`')
    expect(prompt).toContain('call `MDP.listClients` with a narrow search keyword')
    expect(prompt).toContain('call `MDP.listPaths` with that exact `clientId`')
    expect(prompt).toContain('Prefer reading the target client root `/skill.md`')
  })

  it('builds a turn prompt with compact progressive mdp guidance', () => {
    const prompt = buildSessionEntryContextTurnPrompt({
      kind: 'browser',
      page: 'session',
      route: '/session/demo',
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

    expect(prompt).toContain('Current preferred MDP client ids for this turn:')
    expect(prompt).toContain('If you use MDP on this turn, use it progressively:')
    expect(prompt).toContain('Start from the preferred MDP client ids above')
    expect(prompt).toContain('always try MDP before ChromeDevtools')
    expect(prompt).toContain('Use ChromeDevtools only as a fallback')
    expect(prompt).toContain('switch to the `Vibe Forge Server` MDP client')
    expect(prompt).toContain('identify the relevant client first with `MDP.listClients`')
    expect(prompt).toContain('call `MDP.listClients` with a narrow search keyword')
    expect(prompt).toContain('call `MDP.listPaths` with that exact `clientId`')
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
