import { describe, expect, it } from 'vitest'

import {
  mergeSystemPrompts,
  resolveInjectDefaultSystemPromptValue
} from '#~/system-prompt.js'

describe('system prompt controls', () => {
  it('keeps generated and user prompts when default injection is enabled', () => {
    expect(mergeSystemPrompts({
      generatedSystemPrompt: 'generated prompt',
      userSystemPrompt: 'user prompt',
      injectDefaultSystemPrompt: true
    })).toBe('generated prompt\n\nuser prompt')
  })

  it('omits generated prompts when default injection is disabled', () => {
    expect(mergeSystemPrompts({
      generatedSystemPrompt: 'generated prompt',
      userSystemPrompt: 'user prompt',
      injectDefaultSystemPrompt: false
    })).toBe('user prompt')
  })

  it('prefers CLI overrides over config values', () => {
    expect(resolveInjectDefaultSystemPromptValue({
      cliValue: false,
      projectConfig: {
        conversation: {
          injectDefaultSystemPrompt: true
        }
      },
      userConfig: {
        conversation: {
          injectDefaultSystemPrompt: true
        }
      }
    })).toBe(false)
  })

  it('prefers user config over project config when no CLI override exists', () => {
    expect(resolveInjectDefaultSystemPromptValue({
      projectConfig: {
        conversation: {
          injectDefaultSystemPrompt: true
        }
      },
      userConfig: {
        conversation: {
          injectDefaultSystemPrompt: false
        }
      }
    })).toBe(false)
  })

})
