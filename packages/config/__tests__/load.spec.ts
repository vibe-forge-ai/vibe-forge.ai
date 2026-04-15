import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { describe, expect, it, vi } from 'vitest'

import {
  ADAPTER_COMMON_CONFIG_KEYS,
  buildConfigJsonVariables,
  buildResolvedConfigState,
  loadAdapterConfig,
  loadConfig,
  resetConfigCache,
  resolveAdapterConfig,
  resolveConfigState,
  resolveAdapterConfigEntry,
  resolveAdapterCommonConfig,
  resolveAdapterConfigWithContribution,
  splitAdapterConfigEntry
} from '#~/load.js'

const DISABLE_DEV_CONFIG_ENV = '__VF_PROJECT_AI_DISABLE_DEV_CONFIG__'

describe('loadConfig', () => {
  it('can skip workspace dev config via env override', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-load-'))
    const previousCwd = process.cwd()
    const previousDisableDevConfig = process.env[DISABLE_DEV_CONFIG_ENV]

    try {
      await writeFile(
        path.join(tempDir, '.ai.config.json'),
        JSON.stringify({
          defaultModel: 'project-model'
        })
      )
      await writeFile(
        path.join(tempDir, '.ai.dev.config.json'),
        JSON.stringify({
          defaultModel: 'dev-model'
        })
      )

      process.chdir(tempDir)
      process.env[DISABLE_DEV_CONFIG_ENV] = '1'
      resetConfigCache()

      const [projectConfig, userConfig] = await loadConfig({
        jsonVariables: {}
      })

      expect(projectConfig?.defaultModel).toBe('project-model')
      expect(userConfig).toBeUndefined()
    } finally {
      process.chdir(previousCwd)
      if (previousDisableDevConfig == null) {
        delete process.env[DISABLE_DEV_CONFIG_ENV]
      } else {
        process.env[DISABLE_DEV_CONFIG_ENV] = previousDisableDevConfig
      }
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('falls back to the primary workspace dev config when the current worktree has none', async () => {
    const primaryDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-primary-'))
    const worktreeDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-worktree-'))
    const previousPrimaryWorkspace = process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__

    try {
      await writeFile(
        path.join(worktreeDir, '.ai.config.json'),
        JSON.stringify({
          defaultModel: 'project-model'
        })
      )
      await writeFile(
        path.join(primaryDir, '.ai.dev.config.json'),
        JSON.stringify({
          defaultModel: 'primary-dev-model'
        })
      )

      process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__ = primaryDir
      resetConfigCache()

      const [projectConfig, userConfig] = await loadConfig({
        cwd: worktreeDir,
        jsonVariables: {}
      })

      expect(projectConfig?.defaultModel).toBe('project-model')
      expect(userConfig?.defaultModel).toBe('primary-dev-model')
    } finally {
      if (previousPrimaryWorkspace == null) {
        delete process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__
      } else {
        process.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__ = previousPrimaryWorkspace
      }
      resetConfigCache()
      await rm(primaryDir, { force: true, recursive: true })
      await rm(worktreeDir, { force: true, recursive: true })
    }
  })

  it('loads project config from __VF_PROJECT_CONFIG_DIR__ while keeping workspace json variables', async () => {
    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-workspace-'))
    const launchDir = path.join(workspaceDir, 'c', 'd', 'e')
    const workspaceFolderPlaceholder = '${' + 'WORKSPACE_FOLDER}'
    const previousConfigDir = process.env.__VF_PROJECT_CONFIG_DIR__
    const previousLaunchCwd = process.env.__VF_PROJECT_LAUNCH_CWD__
    const previousWorkspaceFolder = process.env.__VF_PROJECT_WORKSPACE_FOLDER__

    try {
      await mkdir(launchDir, { recursive: true })
      await writeFile(
        path.join(launchDir, '.ai.config.json'),
        JSON.stringify({
          env: {
            WORKSPACE_ROOT: workspaceFolderPlaceholder
          }
        })
      )

      process.env.__VF_PROJECT_LAUNCH_CWD__ = launchDir
      process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = '../../..'
      process.env.__VF_PROJECT_CONFIG_DIR__ = '.'
      resetConfigCache()

      const [projectConfig] = await loadConfig({
        cwd: launchDir,
        jsonVariables: buildConfigJsonVariables(launchDir, process.env)
      })

      expect(projectConfig?.env?.WORKSPACE_ROOT).toBe(workspaceDir)
    } finally {
      if (previousConfigDir == null) {
        delete process.env.__VF_PROJECT_CONFIG_DIR__
      } else {
        process.env.__VF_PROJECT_CONFIG_DIR__ = previousConfigDir
      }
      if (previousLaunchCwd == null) {
        delete process.env.__VF_PROJECT_LAUNCH_CWD__
      } else {
        process.env.__VF_PROJECT_LAUNCH_CWD__ = previousLaunchCwd
      }
      if (previousWorkspaceFolder == null) {
        delete process.env.__VF_PROJECT_WORKSPACE_FOLDER__
      } else {
        process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = previousWorkspaceFolder
      }
      resetConfigCache()
      await rm(workspaceDir, { force: true, recursive: true })
    }
  })

  it('resolves extend chains with layered merge semantics', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-extend-'))

    try {
      await writeFile(
        path.join(tempDir, 'base.yaml'),
        `
defaultModelService: openai
env:
  BASE_URL: https://base.example.com
permissions:
  allow:
    - Read
announcements:
  - base
defaultIncludeMcpServers:
  - docs
notifications:
  events:
    completed:
      title: Base Title
marketplaces:
  team-tools:
    type: claude-code
    options:
      source:
        source: settings
        plugins:
          - name: reviewer
            source:
              source: npm
              package: "@acme/reviewer"
plugins:
  - id: logger
    options:
      level: info
adapters:
  codex:
    defaultModel: gpt-4.1
`
      )
      await writeFile(
        path.join(tempDir, '.ai.config.json'),
        JSON.stringify(
          {
            extend: './base.yaml',
            defaultModel: 'project-model',
            env: {
              API_KEY: `\${TEST_API_KEY}`
            },
            permissions: {
              allow: ['Edit']
            },
            announcements: ['project'],
            defaultIncludeMcpServers: ['browser'],
            notifications: {
              events: {
                completed: {
                  description: 'Project Description'
                }
              }
            },
            marketplaces: {
              'team-tools': {
                type: 'claude-code',
                enabled: false
              }
            },
            plugins: [
              {
                id: 'chrome',
                enabled: false,
                options: {
                  headless: true
                }
              }
            ],
            adapters: {
              codex: {
                excludeModels: ['gpt-4.1-mini']
              }
            }
          },
          null,
          2
        )
      )
      await writeFile(
        path.join(tempDir, 'user-base.json'),
        JSON.stringify(
          {
            plugins: [
              {
                id: 'telemetry',
                options: {
                  mode: 'summary'
                }
              }
            ],
            shortcuts: {
              openConfig: 'cmd+,'
            }
          },
          null,
          2
        )
      )
      await writeFile(
        path.join(tempDir, '.ai.dev.config.yaml'),
        `
extend:
  - ./user-base.json
plugins:
  - id: review
shortcuts:
  newSession: cmd+n
`
      )

      resetConfigCache()
      const [projectConfig, userConfig] = await loadConfig({
        cwd: tempDir,
        jsonVariables: {
          TEST_API_KEY: 'secret-key'
        }
      })

      expect(projectConfig).toMatchObject({
        defaultModelService: 'openai',
        defaultModel: 'project-model',
        env: {
          BASE_URL: 'https://base.example.com',
          API_KEY: 'secret-key'
        },
        permissions: {
          allow: ['Read', 'Edit', 'VibeForge']
        },
        announcements: ['base', 'project'],
        defaultIncludeMcpServers: ['docs', 'browser'],
        notifications: {
          events: {
            completed: {
              title: 'Base Title',
              description: 'Project Description'
            }
          }
        },
        marketplaces: {
          'team-tools': {
            type: 'claude-code',
            enabled: false,
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
            options: {
              level: 'info'
            }
          },
          {
            id: 'chrome',
            enabled: false,
            options: {
              headless: true
            }
          }
        ],
        adapters: {
          codex: {
            defaultModel: 'gpt-4.1',
            excludeModels: ['gpt-4.1-mini']
          }
        }
      })
      expect(projectConfig?.extend).toBeUndefined()
      expect(userConfig).toMatchObject({
        plugins: [
          {
            id: 'telemetry',
            options: {
              mode: 'summary'
            }
          },
          {
            id: 'review'
          }
        ],
        shortcuts: {
          openConfig: 'cmd+,',
          newSession: 'cmd+n'
        }
      })
      expect(userConfig?.extend).toBeUndefined()
    } finally {
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('does not inject the built-in MCP permission when config disables the built-in server', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-disable-default-mcp-'))

    try {
      await writeFile(
        path.join(tempDir, '.ai.config.json'),
        JSON.stringify(
          {
            noDefaultVibeForgeMcpServer: true,
            permissions: {
              allow: ['Read']
            }
          },
          null,
          2
        )
      )

      resetConfigCache()
      const [projectConfig] = await loadConfig({
        cwd: tempDir,
        jsonVariables: {}
      })

      expect(projectConfig?.permissions?.allow).toEqual(['Read'])
    } finally {
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('throws a clear error for legacy object-map plugin configs in extend chains', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-legacy-plugins-'))

    try {
      await writeFile(
        path.join(tempDir, 'legacy.json'),
        JSON.stringify(
          {
            plugins: {
              logger: {
                level: 'info'
              }
            }
          },
          null,
          2
        )
      )
      await writeFile(
        path.join(tempDir, '.ai.config.json'),
        JSON.stringify(
          {
            extend: './legacy.json'
          },
          null,
          2
        )
      )

      resetConfigCache()
      const [projectConfig] = await loadConfig({
        cwd: tempDir,
        jsonVariables: {}
      })

      expect(projectConfig).toBeUndefined()
    } finally {
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('resolves extend from dependency packages and package subpaths', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-extend-package-'))

    try {
      const packageRoot = path.join(tempDir, 'node_modules', '@acme', 'vf-preset')
      await mkdir(path.join(packageRoot, 'presets'), { recursive: true })
      await writeFile(
        path.join(packageRoot, 'package.json'),
        JSON.stringify(
          {
            name: '@acme/vf-preset',
            version: '1.0.0'
          },
          null,
          2
        )
      )
      await writeFile(
        path.join(packageRoot, '.ai.config.yaml'),
        `
defaultModelService: preset-service
announcements:
  - package-root
`
      )
      await writeFile(
        path.join(packageRoot, 'presets', 'web.yaml'),
        `
permissions:
  allow:
    - Browser
modelServices:
  browser:
    apiBaseUrl: https://browser.example.com
    apiKey: browser-key
`
      )
      await writeFile(
        path.join(tempDir, '.ai.config.yaml'),
        `
extend:
  - "@acme/vf-preset"
  - "@acme/vf-preset/presets/web"
defaultModel: package-model
`
      )

      resetConfigCache()
      const [projectConfig, userConfig] = await loadConfig({
        cwd: tempDir,
        jsonVariables: {}
      })

      expect(projectConfig).toMatchObject({
        defaultModelService: 'preset-service',
        defaultModel: 'package-model',
        announcements: ['package-root'],
        permissions: {
          allow: ['Browser', 'VibeForge']
        },
        modelServices: {
          browser: {
            apiBaseUrl: 'https://browser.example.com',
            apiKey: 'browser-key'
          }
        }
      })
      expect(projectConfig?.extend).toBeUndefined()
      expect(userConfig).toBeUndefined()
    } finally {
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('returns an empty project config when extend chain is circular', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-extend-cycle-'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await writeFile(
        path.join(tempDir, 'base.json'),
        JSON.stringify(
          {
            extend: './child.json',
            defaultModel: 'base'
          },
          null,
          2
        )
      )
      await writeFile(
        path.join(tempDir, 'child.json'),
        JSON.stringify(
          {
            extend: './base.json',
            defaultModel: 'child'
          },
          null,
          2
        )
      )
      await writeFile(
        path.join(tempDir, '.ai.config.json'),
        JSON.stringify(
          {
            extend: './base.json',
            defaultModel: 'project'
          },
          null,
          2
        )
      )

      resetConfigCache()
      const [projectConfig, userConfig] = await loadConfig({
        cwd: tempDir,
        jsonVariables: {}
      })

      expect(projectConfig).toBeUndefined()
      expect(userConfig).toBeUndefined()
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('builds resolved config state and adapter entries from merged config semantics', () => {
    const state = buildResolvedConfigState(
      {
        defaultModelService: 'project-service',
        adapters: {
          codex: {
            defaultModel: 'project-model',
            includeModels: ['project-include']
          }
        }
      } as any,
      {
        defaultModelService: 'user-service',
        adapters: {
          codex: {
            excludeModels: ['user-exclude']
          }
        }
      } as any
    )

    expect(state.mergedConfig.defaultModelService).toBe('user-service')
    expect(resolveAdapterConfigEntry('codex', state.mergedConfig)).toEqual({
      defaultModel: 'project-model',
      includeModels: ['project-include'],
      excludeModels: ['user-exclude']
    })
  })

  it('splits adapter config into common and native sections while allowing extra common keys', () => {
    const result = splitAdapterConfigEntry({
      defaultModel: 'gpt-5.4',
      includeModels: ['gpt-5.4'],
      excludeModels: ['gpt-4.1'],
      effort: 'high',
      routingProfile: 'strict',
      settingsContent: {
        nested: true
      },
      model: 'legacy-model'
    } as {
      defaultModel?: string
      includeModels?: string[]
      excludeModels?: string[]
      effort?: string
      routingProfile?: string
      settingsContent?: Record<string, unknown>
      model?: string
    }, {
      extraCommonKeys: ['routingProfile']
    })

    expect(ADAPTER_COMMON_CONFIG_KEYS).toEqual([
      'defaultModel',
      'includeModels',
      'excludeModels',
      'effort'
    ])
    expect(result.common).toEqual({
      defaultModel: 'gpt-5.4',
      includeModels: ['gpt-5.4'],
      excludeModels: ['gpt-4.1'],
      effort: 'high',
      routingProfile: 'strict',
      model: 'legacy-model'
    })
    expect(result.native).toEqual({
      settingsContent: {
        nested: true
      }
    })
  })

  it('resolves adapter common config from merged config state', () => {
    const state = buildResolvedConfigState(
      {
        adapters: {
          codex: {
            defaultModel: 'project-model',
            includeModels: ['project-include']
          }
        }
      } as any,
      {
        adapters: {
          codex: {
            excludeModels: ['user-exclude'],
            effort: 'high',
            configOverrides: {
              model: 'gpt-5.4'
            }
          }
        }
      } as any
    )

    expect(resolveAdapterCommonConfig('codex', {
      configState: state
    })).toEqual({
      defaultModel: 'project-model',
      includeModels: ['project-include'],
      excludeModels: ['user-exclude'],
      effort: 'high'
    })
  })

  it('reuses a precomputed resolved config state when available', () => {
    const state = buildResolvedConfigState(
      {
        defaultModel: 'project-model'
      } as any,
      {
        defaultModel: 'user-model'
      } as any
    )

    expect(resolveConfigState({
      configState: state,
      configs: [
        {
          defaultModel: 'stale-project-model'
        } as any,
        undefined
      ]
    })).toBe(state)
  })

  it('resolves adapter config sections from the merged config state', () => {
    const state = buildResolvedConfigState(
      {
        adapters: {
          'claude-code': {
            defaultModel: 'project-model',
            effort: 'medium',
            settingsContent: {
              permissionMode: 'plan'
            }
          }
        }
      } as any,
      {
        adapters: {
          'claude-code': {
            effort: 'high'
          }
        }
      } as any
    )

    const result = resolveAdapterConfig<{
      defaultModel?: string
      effort?: string
      settingsContent?: Record<string, unknown>
    }>('claude-code', {
      configState: state
    })

    expect(result.common).toEqual({
      defaultModel: 'project-model',
      effort: 'high'
    })
    expect(result.native).toEqual({
      settingsContent: {
        permissionMode: 'plan'
      }
    })
  })

  it('deep merges declared native adapter config keys across project and user configs', () => {
    const state = buildResolvedConfigState(
      {
        adapters: {
          'claude-code': {
            settingsContent: {
              outputStyle: {
                tone: 'concise',
                bullets: true
              }
            },
            ccrOptions: {
              PORT: '4123'
            }
          }
        }
      } as any,
      {
        adapters: {
          'claude-code': {
            settingsContent: {
              outputStyle: {
                bullets: false
              },
              approvals: {
                mode: 'plan'
              }
            },
            ccrOptions: {
              APIKEY: 'router-key'
            }
          }
        }
      } as any
    )

    const result = resolveAdapterConfig<{
      settingsContent?: Record<string, unknown>
      ccrOptions?: Record<string, unknown>
    }>('claude-code', {
      configState: state
    }, {
      deepMergeKeys: ['settingsContent', 'ccrOptions']
    })

    expect(result.native).toEqual({
      settingsContent: {
        outputStyle: {
          tone: 'concise',
          bullets: false
        },
        approvals: {
          mode: 'plan'
        }
      },
      ccrOptions: {
        PORT: '4123',
        APIKEY: 'router-key'
      }
    })
  })

  it('reuses contribution metadata when resolving adapter config', () => {
    const state = buildResolvedConfigState(
      {
        adapters: {
          'claude-code': {
            defaultModel: 'project-model',
            effort: 'medium',
            settingsContent: {
              outputStyle: {
                tone: 'concise',
                bullets: true
              }
            }
          }
        }
      } as any,
      {
        adapters: {
          'claude-code': {
            effort: 'high',
            settingsContent: {
              outputStyle: {
                bullets: false
              },
              approvals: {
                mode: 'plan'
              }
            }
          }
        }
      } as any
    )

    const result = resolveAdapterConfigWithContribution<{
      defaultModel?: string
      effort?: string
      settingsContent?: Record<string, unknown>
    }>({
      adapterKey: 'claude-code',
      configEntry: {
        deepMergeKeys: ['settingsContent']
      }
    }, {
      configState: state
    })

    expect(result.common).toEqual({
      defaultModel: 'project-model',
      effort: 'high'
    })
    expect(result.native).toEqual({
      settingsContent: {
        outputStyle: {
          tone: 'concise',
          bullets: false
        },
        approvals: {
          mode: 'plan'
        }
      }
    })
  })

  it('loads adapter config through the resolved config helper path', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-adapter-load-'))

    try {
      await writeFile(
        path.join(tempDir, '.ai.config.json'),
        JSON.stringify({
          adapters: {
            codex: {
              defaultModel: 'project-model'
            }
          }
        })
      )
      await writeFile(
        path.join(tempDir, '.ai.dev.config.json'),
        JSON.stringify({
          adapters: {
            codex: {
              excludeModels: ['user-exclude']
            }
          }
        })
      )

      resetConfigCache()
      const config = await loadAdapterConfig('codex', {
        cwd: tempDir,
        jsonVariables: {}
      })

      expect(config).toEqual({
        defaultModel: 'project-model',
        excludeModels: ['user-exclude']
      })
    } finally {
      resetConfigCache()
      await rm(tempDir, { force: true, recursive: true })
    }
  })
})
