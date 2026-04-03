import { describe, expect, it } from 'vitest'

import { normalizePath, resolvePromptPath, resolveRelativePath } from '#~/document-path.js'

describe('document path utils', () => {
  it('normalizes windows separators', () => {
    expect(normalizePath('foo\\bar\\baz.md')).toBe('foo/bar/baz.md')
  })

  it('resolves relative and prompt paths against the workspace root', () => {
    expect(resolveRelativePath('/tmp/project', '/tmp/project/.ai/rules/x.md')).toBe('.ai/rules/x.md')
    expect(resolvePromptPath('/tmp/project', '/outside/path/rule.md')).toBe('/outside/path/rule.md')
  })
})
