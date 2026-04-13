import { describe, expect, it } from 'vitest'

import { buildGenericToolPresentation } from '#~/components/chat/tools/core/generic-tool-presentation'

describe('generic tool presentation', () => {
  it('extracts a compact target and diff for codex EditFile tools', () => {
    const presentation = buildGenericToolPresentation('adapter:codex:EditFile', {
      path: '/tmp/example.tsx',
      oldString: 'const before = true\n',
      newString: 'const after = false\n'
    })

    expect(presentation.fallbackTitle).toBe('Edit File')
    expect(presentation.primary).toBe('/tmp/example.tsx')
    expect(presentation.diff).toEqual(expect.objectContaining({
      original: 'const before = true\n',
      modified: 'const after = false\n',
      language: 'tsx'
    }))
    expect(presentation.suppressSuccessResult).toBe(true)
  })

  it('uses patch targets instead of raw patch text as the summary target', () => {
    const presentation = buildGenericToolPresentation('adapter:codex:ApplyPatch', {
      patch: [
        '*** Begin Patch',
        '*** Add File: /tmp/example.ts',
        '+export const value = 1',
        '*** End Patch'
      ].join('\n')
    })

    expect(presentation.fallbackTitle).toBe('Apply Patch')
    expect(presentation.primary).toBe('/tmp/example.ts')
    expect(presentation.blockFields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        labelKey: 'chat.tools.fields.patch',
        format: 'code',
        lang: 'diff'
      })
    ]))
  })

  it('renders codex file-change summaries as compact lists', () => {
    const presentation = buildGenericToolPresentation('adapter:codex:FileChange', {
      status: 'completed',
      changes: [
        { kind: 'add', path: '/tmp/a.ts' },
        { kind: 'delete', path: '/tmp/b.ts' }
      ]
    })

    expect(presentation.primary).toBe('2 files')
    expect(presentation.inlineFields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        labelKey: 'chat.tools.fields.status',
        format: 'inline',
        value: 'completed'
      })
    ]))
    expect(presentation.blockFields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        labelKey: 'chat.tools.fields.changes',
        format: 'list',
        value: ['add /tmp/a.ts', 'delete /tmp/b.ts']
      })
    ]))
  })
})
