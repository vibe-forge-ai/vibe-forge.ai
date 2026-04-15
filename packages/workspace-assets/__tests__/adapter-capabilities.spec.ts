import { describe, expect, it } from 'vitest'

import { resolveNativeSkillDiagnosticReason, supportsNativeProjectSkills } from '#~/adapter-capabilities.js'

describe('adapter native skill capabilities', () => {
  it('treats gemini as a native skill adapter', () => {
    expect(supportsNativeProjectSkills('gemini')).toBe(true)
    expect(resolveNativeSkillDiagnosticReason('gemini')).toContain('Gemini')
  })

  it('does not treat codex as a native skill adapter', () => {
    expect(supportsNativeProjectSkills('codex')).toBe(false)
  })
})
