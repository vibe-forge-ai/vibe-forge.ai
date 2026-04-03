import { describe, expect, it } from 'vitest'

import {
  createRemoteRuleDefinition,
  isAlwaysRule,
  isLocalRuleReference,
  isPathLikeReference,
  isRemoteRuleReference,
  parseScopedReference,
  resolveDefinitionName,
  resolveDocumentDescription,
  resolveDocumentName,
  resolveEntityIdentifier,
  resolveSkillIdentifier,
  resolveSpecIdentifier
} from '#~/index.js'

describe('definition core helpers', () => {
  it('prefers explicit document names and handles index files', () => {
    expect(resolveDocumentName('/tmp/specs/index.md', '  explicit  ')).toBe('explicit')
    expect(resolveDocumentName('/tmp/skills/example/SKILL.md', undefined, ['skill.md'])).toBe('example')
  })

  it('resolves spec, entity, and skill identifiers from conventional files', () => {
    expect(resolveSpecIdentifier('/tmp/specs/my-spec/index.md')).toBe('my-spec')
    expect(resolveEntityIdentifier('/tmp/project/.ai/entities/reviewer/README.md')).toBe('reviewer')
    expect(resolveSkillIdentifier('/tmp/project/.ai/skills/research/SKILL.md')).toBe('research')
  })

  it('resolves definition names from explicit names, resolved names, and file paths', () => {
    expect(resolveDefinitionName({
      path: '/tmp/project/.ai/rules/base.md',
      body: '',
      attributes: {}
    })).toBe('base')

    expect(resolveDefinitionName({
      path: '/tmp/project/.ai/specs/release/index.md',
      body: '',
      attributes: {},
      resolvedName: 'demo/release'
    }, ['index.md'])).toBe('demo/release')
  })

  it('resolves descriptions from explicit descriptions or the first non-empty body line', () => {
    expect(resolveDocumentDescription('first line\nsecond line', ' explicit ', 'fallback')).toBe('explicit')
    expect(resolveDocumentDescription('\nfirst line\nsecond line', undefined, 'fallback')).toBe('first line')
    expect(resolveDocumentDescription('\n\n', undefined, 'fallback')).toBe('fallback')
  })

  it('supports rule always compatibility across always and alwaysApply', () => {
    expect(isAlwaysRule({ always: true })).toBe(true)
    expect(isAlwaysRule({ alwaysApply: true })).toBe(true)
    expect(isAlwaysRule({ always: false, alwaysApply: true })).toBe(false)
    expect(isAlwaysRule({})).toBe(false)
  })

  it('identifies local and remote rule references consistently', () => {
    expect(isLocalRuleReference({ path: './rules/base.md' })).toBe(true)
    expect(isLocalRuleReference({ type: 'local', path: './rules/base.md' })).toBe(true)
    expect(isLocalRuleReference({ type: 'remote', tags: ['business'] })).toBe(false)

    expect(isRemoteRuleReference({ type: 'remote', tags: ['business'] })).toBe(true)
    expect(isRemoteRuleReference({ path: './rules/base.md' })).toBe(false)
    expect(isRemoteRuleReference('rules/base.md')).toBe(false)
  })

  it('parses scoped references while excluding path-like values', () => {
    expect(parseScopedReference('demo/release')).toEqual({ scope: 'demo', name: 'release' })
    expect(parseScopedReference('./rules/base.md')).toBeUndefined()
    expect(parseScopedReference('/abs/path/rule.md')).toBeUndefined()
    expect(parseScopedReference('release.md')).toBeUndefined()
    expect(parseScopedReference('demo/server.yaml', { pathSuffixes: ['.md', '.json', '.yaml', '.yml'] }))
      .toBeUndefined()
  })

  it('detects path-like references with optional glob support', () => {
    expect(isPathLikeReference('./rules/base.md')).toBe(true)
    expect(isPathLikeReference('/abs/path/rule.md')).toBe(true)
    expect(isPathLikeReference('rules/*.md', { allowGlob: true })).toBe(true)
    expect(isPathLikeReference('demo/release')).toBe(false)
    expect(isPathLikeReference('demo/server.yaml', { pathSuffixes: ['.md', '.json', '.yaml', '.yml'] })).toBe(true)
  })

  it('builds remote rule definitions with normalized descriptions and tags', () => {
    expect(createRemoteRuleDefinition({
      type: 'remote',
      tags: [' business ', '', 'api-develop']
    }, 1)).toEqual({
      path: 'remote-rule-2.md',
      body: [
        'Remote knowledge base tags: business, api-develop',
        'Knowledge base tags: business, api-develop',
        'This rule comes from a remote knowledge base reference and does not correspond to a local file.'
      ].join('\n'),
      attributes: {
        name: 'remote:business,api-develop',
        description: 'Remote knowledge base tags: business, api-develop'
      }
    })
  })

  it('prefers explicit remote rule descriptions when present', () => {
    expect(
      createRemoteRuleDefinition({
        type: 'remote',
        tags: ['business'],
        desc: 'Look up remote business knowledge when needed'
      }, 0).attributes.description
    ).toBe('Look up remote business knowledge when needed')
  })
})
