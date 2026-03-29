import { describe, expect, it } from 'vitest'

import {
  normalizePath,
  resolveDocumentName,
  resolvePromptPath,
  resolveRelativePath,
  resolveSpecIdentifier
} from '#~/document-path.js'

describe('document path utils', () => {
  it('normalizes windows separators', () => {
    expect(normalizePath('foo\\bar\\baz.md')).toBe('foo/bar/baz.md')
  })

  it('prefers explicit document names and handles index files', () => {
    expect(resolveDocumentName('/tmp/specs/index.md', '  explicit  ')).toBe('explicit')
    expect(resolveDocumentName('/tmp/skills/example/SKILL.md', undefined, ['skill.md'])).toBe('example')
  })

  it('resolves relative and prompt paths against the workspace root', () => {
    expect(resolveRelativePath('/tmp/project', '/tmp/project/.ai/rules/x.md')).toBe('.ai/rules/x.md')
    expect(resolvePromptPath('/tmp/project', '/outside/path/rule.md')).toBe('/outside/path/rule.md')
  })

  it('resolves spec identifiers using index.md conventions', () => {
    expect(resolveSpecIdentifier('/tmp/specs/my-spec/index.md')).toBe('my-spec')
  })
})
