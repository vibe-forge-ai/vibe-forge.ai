import { describe, expect, it } from 'vitest'

import {
  parseRequestBodyRecord,
  resolveCreateSessionParentSessionId
} from '#~/services/mdp/runtime.js'

describe('parseRequestBodyRecord', () => {
  it('returns object payloads as-is', () => {
    expect(parseRequestBodyRecord({ initialMessage: 'hello' })).toEqual({
      initialMessage: 'hello'
    })
  })

  it('parses JSON string payloads into objects', () => {
    expect(parseRequestBodyRecord('{\"initialMessage\":\"hello\",\"adapter\":\"codex\"}')).toEqual({
      initialMessage: 'hello',
      adapter: 'codex'
    })
  })

  it('ignores non-object payloads', () => {
    expect(parseRequestBodyRecord('\"hello\"')).toBeUndefined()
    expect(parseRequestBodyRecord('')).toBeUndefined()
    expect(parseRequestBodyRecord(null)).toBeUndefined()
  })
})

describe('resolveCreateSessionParentSessionId', () => {
  it('prefers an explicit parentSessionId in the payload', () => {
    expect(resolveCreateSessionParentSessionId({
      payload: {
        parentSessionId: 'parent-explicit'
      },
      entryContext: {
        kind: 'browser',
        page: 'session',
        route: '/session/current',
        activeSessionId: 'session-current'
      }
    })).toBe('parent-explicit')
  })

  it('defaults to the active browser session when no parent is provided', () => {
    expect(resolveCreateSessionParentSessionId({
      payload: {},
      entryContext: {
        kind: 'browser',
        page: 'session',
        route: '/session/current',
        activeSessionId: 'session-current'
      }
    })).toBe('session-current')
  })

  it('defaults to the current cli session when no parent is provided', () => {
    expect(resolveCreateSessionParentSessionId({
      payload: {},
      entryContext: {
        kind: 'cli',
        sessionId: 'cli-session',
        cwd: '/workspace'
      }
    })).toBe('cli-session')
  })
})
