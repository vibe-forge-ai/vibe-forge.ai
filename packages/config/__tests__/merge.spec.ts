import { describe, expect, it } from 'vitest'

import { mergeConfigs } from '#~/merge.js'

describe('mergeConfigs', () => {
  it('merges layered config values with config-specific rules', () => {
    const merged = mergeConfigs(
      {
        defaultModel: 'base-model',
        adapters: {
          codex: {
            defaultModel: 'gpt-4.1',
            includeModels: ['gpt-4.1']
          }
        },
        env: {
          BASE_URL: 'https://base.example.com'
        },
        permissions: {
          allow: ['Read'],
          defaultMode: 'plan'
        },
        announcements: ['base'],
        defaultIncludeMcpServers: ['docs'],
        notifications: {
          events: {
            completed: {
              title: 'Base Title'
            }
          }
        },
        skills: {
          registry: {
            url: 'https://skills.example.com',
            enabled: true
          }
        },
        marketplaces: {
          'team-tools': {
            type: 'claude-code',
            syncOnRun: true,
            plugins: {
              reviewer: {
                scope: 'review'
              }
            },
            options: {
              source: {
                source: 'settings',
                plugins: [
                  {
                    name: 'reviewer',
                    source: {
                      source: 'npm',
                      package: '@acme/reviewer'
                    }
                  }
                ]
              }
            }
          }
        },
        plugins: [
          {
            id: 'logger',
            enabled: false,
            options: {
              level: 'info'
            }
          }
        ]
      },
      {
        adapters: {
          codex: {
            excludeModels: ['gpt-4.1-mini']
          }
        },
        env: {
          API_KEY: 'secret'
        },
        permissions: {
          allow: ['Edit']
        },
        announcements: ['override'],
        defaultIncludeMcpServers: ['browser', 'docs'],
        notifications: {
          events: {
            completed: {
              description: 'Child Description'
            }
          }
        },
        skills: {
          registry: {
            downloadUrl: 'https://download.skills.example.com'
          }
        },
        marketplaces: {
          'team-tools': {
            type: 'claude-code',
            enabled: false,
            plugins: {
              reviewer: {
                enabled: false
              },
              chrome: {
                scope: 'browser'
              }
            }
          }
        },
        plugins: [
          {
            id: 'chrome',
            options: {
              headless: true
            }
          }
        ]
      }
    )

    expect(merged.defaultModel).toBe('base-model')
    expect(merged.adapters?.codex).toEqual({
      defaultModel: 'gpt-4.1',
      includeModels: ['gpt-4.1'],
      excludeModels: ['gpt-4.1-mini']
    })
    expect(merged.env).toEqual({
      BASE_URL: 'https://base.example.com',
      API_KEY: 'secret'
    })
    expect(merged.permissions).toEqual({
      allow: ['Read', 'Edit'],
      defaultMode: 'plan',
      deny: undefined,
      ask: undefined
    })
    expect(merged.announcements).toEqual(['base', 'override'])
    expect(merged.defaultIncludeMcpServers).toEqual(['docs', 'browser'])
    expect(merged.notifications?.events?.completed).toEqual({
      title: 'Base Title',
      description: 'Child Description'
    })
    expect(merged.skills).toEqual({
      registry: {
        downloadUrl: 'https://download.skills.example.com'
      }
    })
    expect(merged.marketplaces).toEqual({
      'team-tools': {
        type: 'claude-code',
        enabled: false,
        syncOnRun: true,
        plugins: {
          reviewer: {
            enabled: false,
            scope: 'review'
          },
          chrome: {
            scope: 'browser'
          }
        },
        options: {
          source: {
            source: 'settings',
            plugins: [
              {
                name: 'reviewer',
                source: {
                  source: 'npm',
                  package: '@acme/reviewer'
                }
              }
            ]
          }
        }
      }
    })
    expect(merged.plugins).toEqual([
      {
        id: 'logger',
        enabled: false,
        options: {
          level: 'info'
        }
      },
      {
        id: 'chrome',
        options: {
          headless: true
        }
      }
    ])
  })
})
