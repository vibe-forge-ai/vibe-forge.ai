import { describe, expect, it } from 'vitest'

import { buildMessageContent, getInitialComposerState } from '#~/components/chat/sender/content-attachments'

describe('sender content attachments helpers', () => {
  it('hydrates pending files from structured content', () => {
    expect(getInitialComposerState([
      { type: 'text', text: 'Inspect this' },
      { type: 'file', path: 'apps/server/src/index.ts', name: 'index.ts' }
    ])).toEqual({
      input: 'Inspect this',
      pendingImages: [],
      pendingFiles: [
        {
          path: 'apps/server/src/index.ts',
          name: 'index.ts',
          size: undefined
        }
      ]
    })
  })

  it('builds message content with files appended after text and images', () => {
    expect(buildMessageContent('Inspect this', [{
      id: 'img-1',
      url: 'data:image/png;base64,abc',
      name: 'shot.png',
      mimeType: 'image/png'
    }], [{
      path: 'apps/client/src/main.tsx',
      name: 'main.tsx'
    }])).toEqual([
      { type: 'text', text: 'Inspect this' },
      {
        type: 'image',
        url: 'data:image/png;base64,abc',
        name: 'shot.png',
        size: undefined,
        mimeType: 'image/png'
      },
      {
        type: 'file',
        path: 'apps/client/src/main.tsx',
        name: 'main.tsx',
        size: undefined
      }
    ])
  })
})
