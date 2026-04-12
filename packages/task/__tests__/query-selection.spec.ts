import { describe, expect, it } from 'vitest'

import { resolveQuerySelection } from '#~/query-selection.js'

describe('resolveQuerySelection', () => {
  it('prefers defaultModelService when an explicit bare model matches multiple services', () => {
    const selection = resolveQuerySelection({
      config: {
        adapters: {
          codex: {},
          'claude-code': {}
        },
        modelServices: {
          gpt: {
            apiBaseUrl: 'https://search.example.com/gpt',
            apiKey: 'token-gpt',
            models: ['gpt-5.4-2026-03-05']
          },
          'gpt-responses': {
            apiBaseUrl: 'https://responses.example.com',
            apiKey: 'token-responses',
            models: ['gpt-5.4-2026-03-05']
          }
        },
        defaultModelService: 'gpt-responses'
      } as any,
      userConfig: undefined,
      inputModel: 'gpt-5.4-2026-03-05'
    })

    expect(selection.model).toBe('gpt-responses,gpt-5.4-2026-03-05')
  })
})
