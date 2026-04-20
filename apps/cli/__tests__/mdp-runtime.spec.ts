import { describe, expect, it } from 'vitest'

import {
  buildCliInputSkillContent,
  buildCliInteractionSkillContent,
  buildCliProcessSkillContent,
  buildCliSkillContent,
  toCliInteractionData,
  toCliMessageContent
} from '#~/mdp/runtime-helpers.js'

describe('CLI MDP runtime helpers', () => {
  it('builds the split rootless CLI runtime skill documents', () => {
    expect(buildCliSkillContent()).toContain('/state')
    expect(buildCliSkillContent()).toContain('/process/skill.md')
    expect(buildCliInputSkillContent()).toContain('/input/send')
    expect(buildCliInteractionSkillContent()).toContain('/interaction/respond')
    expect(buildCliProcessSkillContent()).toContain('/process/kill')
  })

  it('normalizes string and structured message payloads', () => {
    expect(toCliMessageContent('hello')).toEqual([{ type: 'text', text: 'hello' }])
    expect(toCliMessageContent({ text: 'world' })).toEqual([{ type: 'text', text: 'world' }])
    expect(toCliMessageContent({
      content: [{ type: 'text', text: 'typed' }]
    })).toEqual([{ type: 'text', text: 'typed' }])
  })

  it('rejects empty message payloads', () => {
    expect(() => toCliMessageContent('  ')).toThrow('message content is required')
    expect(() => toCliMessageContent({})).toThrow('message content is required')
  })

  it('normalizes interaction reply payloads', () => {
    expect(toCliInteractionData('allow_once')).toBe('allow_once')
    expect(toCliInteractionData(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('rejects invalid interaction reply payloads', () => {
    expect(() => toCliInteractionData('')).toThrow('interaction data is required')
    expect(() => toCliInteractionData(['', 'b'])).toThrow(
      'interaction data must be a non-empty string or string array'
    )
  })
})
