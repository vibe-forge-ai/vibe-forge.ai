import { describe, expect, it } from 'vitest'

import { buildInlineConfigContent, buildToolConfig, buildToolPermissionConfig } from '#~/runtime/common.js'

describe('openCode permission and tool helpers', () => {
  it('derives permission overrides from tool selection aliases', () => {
    expect(buildToolPermissionConfig({
      include: ['grep', 'view'],
      exclude: ['bash']
    })).toEqual({
      '*': 'deny',
      bash: 'deny',
      edit: 'deny',
      glob: 'deny',
      grep: 'allow',
      question: 'deny',
      read: 'allow',
      list: 'deny',
      lsp: 'deny',
      skill: 'deny',
      task: 'deny',
      todoread: 'deny',
      todowrite: 'deny',
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny'
    })
  })

  it('preserves permission mode semantics for included tools', () => {
    expect(buildToolPermissionConfig(
      { include: ['bash', 'write'] },
      { '*': 'allow', bash: 'ask', edit: 'deny' }
    )).toMatchObject({
      '*': 'deny',
      bash: 'ask',
      edit: 'deny'
    })
  })

  it('preserves custom tool permissions and nested rules when includes are narrowed', () => {
    expect(buildToolPermissionConfig(
      {
        include: ['bash', 'mcp__docs__*'],
        exclude: ['websearch']
      },
      {
        bash: {
          '*': 'ask',
          'rm *': 'deny'
        },
        'mcp__docs__*': 'ask'
      } as any
    )).toMatchObject({
      '*': 'deny',
      bash: {
        '*': 'ask',
        'rm *': 'deny'
      },
      'mcp__docs__*': 'ask',
      websearch: 'deny',
      edit: 'deny'
    })
  })

  it('normalizes tool aliases to OpenCode tool names', () => {
    expect(buildToolConfig({
      include: ['view', 'fetch', 'question', 'mcp__docs__*', 'agent'],
      exclude: ['ls', 'write', 'task', 'custom-tool']
    })).toEqual({
      read: true,
      webfetch: true,
      question: true,
      'mcp__docs__*': true,
      list: false,
      write: false,
      'custom-tool': false
    })
  })

  it('treats wildcard include as a no-op for tool toggles while preserving explicit excludes', () => {
    expect(buildToolConfig({
      include: ['*', 'agent'],
      exclude: ['bash', '*']
    })).toEqual({
      bash: false
    })

    expect(buildToolPermissionConfig({
      include: ['*'],
      exclude: ['bash']
    })).toEqual({
      bash: 'deny'
    })
  })

  it('keeps dontAsk mode non-interactive while preserving explicit denies', () => {
    const config = buildInlineConfigContent({
      adapterConfigContent: {
        permission: {
          bash: 'ask',
          edit: 'deny',
          skill: {
            '*': 'ask',
            'internal-*': 'deny'
          }
        }
      },
      permissionMode: 'dontAsk'
    })

    expect(config).toMatchObject({
      permission: {
        '*': 'allow',
        bash: 'allow',
        edit: 'deny',
        skill: {
          '*': 'allow',
          'internal-*': 'deny'
        }
      }
    })
  })

  it('lets bypassPermissions clear inherited denies recursively', () => {
    expect(buildInlineConfigContent({
      adapterConfigContent: {
        permission: {
          '*': 'deny',
          bash: 'ask',
          skill: {
            '*': 'deny',
            'internal-*': 'deny'
          }
        }
      },
      permissionMode: 'bypassPermissions'
    })).toMatchObject({
      permission: {
        '*': 'allow',
        bash: 'allow',
        skill: {
          '*': 'allow',
          'internal-*': 'allow'
        }
      }
    })
  })

  it('preserves nested skill permission config while applying runtime overrides', () => {
    expect(buildInlineConfigContent({
      adapterConfigContent: {
        permission: {
          skill: {
            '*': 'allow',
            'internal-*': 'deny'
          }
        }
      },
      permissionMode: 'default',
      tools: {
        exclude: ['bash']
      }
    })).toMatchObject({
      permission: {
        '*': 'allow',
        bash: 'deny',
        edit: 'ask',
        task: 'ask',
        skill: {
          '*': 'allow',
          'internal-*': 'deny'
        }
      }
    })
  })
})
