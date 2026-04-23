import { describe, expect, it } from 'vitest'

import {
  buildDeferredSessionRuntimeUpdateEffect,
  buildSessionModelUpdateResult,
  buildSessionRuntimeUpdateRejectionDetails,
  getSessionUpdateDisallowedRuntimeFields,
  parseRequestBodyRecord,
  parseSessionModelUpdatePayload,
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

describe('getSessionUpdateDisallowedRuntimeFields', () => {
  it('flags runtime fields that must use dedicated session paths', () => {
    expect(getSessionUpdateDisallowedRuntimeFields({
      model: 'gpt-5.3',
      title: 'rename',
      effort: 'high'
    })).toEqual(['model', 'effort'])
  })

  it('returns an empty list for metadata-only session updates', () => {
    expect(getSessionUpdateDisallowedRuntimeFields({
      title: 'rename',
      isStarred: true
    })).toEqual([])
  })
})

describe('parseSessionModelUpdatePayload', () => {
  it('extracts model from object payloads', () => {
    expect(parseSessionModelUpdatePayload({
      model: 'gpt-5.3'
    })).toEqual({
      model: 'gpt-5.3'
    })
  })

  it('extracts model from JSON string payloads', () => {
    expect(parseSessionModelUpdatePayload('{\"model\":\"gpt-5.3\"}')).toEqual({
      model: 'gpt-5.3'
    })
  })

  it('returns undefined when model is missing or empty', () => {
    expect(parseSessionModelUpdatePayload('{}')).toBeUndefined()
    expect(parseSessionModelUpdatePayload({ model: '' })).toBeUndefined()
  })
})

describe('buildDeferredSessionRuntimeUpdateEffect', () => {
  it('describes changed runtime updates as deferred to the next turn for idle sessions', () => {
    expect(buildDeferredSessionRuntimeUpdateEffect({
      noun: 'model',
      changed: true
    })).toEqual({
      appliesToCurrentTurn: false,
      effectiveAt: 'next_turn',
      message: 'The persisted model was updated. It will be used when the next turn starts.'
    })
  })

  it('describes changed runtime updates for a running session as applying after the current turn', () => {
    expect(buildDeferredSessionRuntimeUpdateEffect({
      noun: 'model',
      changed: true,
      hasActiveTurn: true
    })).toEqual({
      appliesToCurrentTurn: false,
      effectiveAt: 'next_turn',
      message: 'The persisted model was updated. This does not affect the current running turn. It takes effect after the current turn finishes, starting with the next turn.'
    })
  })

  it('describes unchanged runtime updates as already persisted', () => {
    expect(buildDeferredSessionRuntimeUpdateEffect({
      noun: 'model',
      changed: false
    })).toEqual({
      appliesToCurrentTurn: false,
      effectiveAt: 'already_persisted',
      message: 'The requested model is already persisted for this session. It will be used when the next turn starts.'
    })
  })

  it('describes unchanged runtime updates for a running session as not affecting the current turn', () => {
    expect(buildDeferredSessionRuntimeUpdateEffect({
      noun: 'model',
      changed: false,
      hasActiveTurn: true
    })).toEqual({
      appliesToCurrentTurn: false,
      effectiveAt: 'already_persisted',
      message: 'The requested model is already persisted for this session. The current running turn keeps using the existing runtime until it finishes.'
    })
  })
})

describe('buildSessionModelUpdateResult', () => {
  it('returns callPath-friendly metadata for model switches', () => {
    expect(buildSessionModelUpdateResult({
      changed: true,
      previousModel: 'gpt-5.4',
      session: {
        id: 'sess-1',
        model: 'gpt-5.3',
        status: 'running'
      } as any
    })).toEqual({
      ok: true,
      changed: true,
      previousModel: 'gpt-5.4',
      session: {
        id: 'sess-1',
        model: 'gpt-5.3',
        status: 'running'
      },
      appliesToCurrentTurn: false,
      effectiveAt: 'next_turn',
      message: 'The persisted model was updated. This does not affect the current running turn. It takes effect after the current turn finishes, starting with the next turn.',
      runtimeUpdate: {
        kind: 'model',
        appliesToCurrentTurn: false,
        effectiveAt: 'next_turn',
        message: 'The persisted model was updated. This does not affect the current running turn. It takes effect after the current turn finishes, starting with the next turn.'
      }
    })
  })
})

describe('buildSessionRuntimeUpdateRejectionDetails', () => {
  it('includes deferred-effect guidance for unsupported runtime updates', () => {
    expect(buildSessionRuntimeUpdateRejectionDetails({
      sessionId: 'sess-1',
      disallowedFields: ['model', 'effort'],
      recommendedPath: '/sessions/sess-1/model'
    })).toEqual({
      sessionId: 'sess-1',
      disallowedFields: ['model', 'effort'],
      recommendedPath: '/sessions/sess-1/model',
      appliesToCurrentTurn: false,
      effectiveAt: 'next_turn',
      message: 'Runtime-affecting session changes do not affect the current running turn. Persisted changes take effect after the current turn finishes, starting with the next turn.'
    })
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
