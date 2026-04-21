import { describe, expect, it } from 'vitest'

import { parseRequestBodyRecord } from '#~/services/mdp/runtime.js'

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
