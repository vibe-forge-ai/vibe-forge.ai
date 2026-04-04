import { describe, expect, it } from 'vitest'

import { mapAdapterContentToClaudeContent } from '../src/protocol/content'

describe('mapAdapterContentToClaudeContent', () => {
  it('maps workspace file attachments to text context entries', () => {
    expect(mapAdapterContentToClaudeContent([
      { type: 'file', path: 'apps/server/src/index.ts' }
    ] as any)).toEqual([
      { type: 'text', text: 'Context file: apps/server/src/index.ts' }
    ])
  })
})
