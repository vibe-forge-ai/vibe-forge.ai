import { describe, expect, it } from 'vitest'

import { sanitizeOpenAIResponsesInputValue } from '../src/ccr/transformers/openai-input'

describe('sanitizeOpenAIResponsesInputValue', () => {
  it('removes thinking metadata from response input messages recursively', () => {
    expect(sanitizeOpenAIResponsesInputValue({
      role: 'assistant',
      content: [
        {
          type: 'output_text',
          text: 'done',
          thinking: {
            content: 'hidden'
          }
        }
      ],
      thinking: {
        content: 'summary'
      },
      annotations: [
        {
          type: 'citation',
          thinking: {
            content: 'nested'
          }
        }
      ]
    })).toEqual({
      role: 'assistant',
      content: [
        {
          type: 'output_text',
          text: 'done'
        }
      ],
      annotations: [
        {
          type: 'citation'
        }
      ]
    })
  })
})
