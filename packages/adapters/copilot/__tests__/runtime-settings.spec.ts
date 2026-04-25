import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ensureCopilotConfigDir, ensureCopilotRuntimeSettings, resolveAdapterConfig } from '#~/runtime/shared.js'

import { makeCtx, makeTempDir, registerRuntimeTestHooks } from './runtime-test-helpers'

describe('copilot runtime settings', () => {
  registerRuntimeTestHooks()

  it('deep-merges project and user Copilot cli/configContent before runtime use', () => {
    const { ctx } = makeCtx({
      configs: [{
        adapters: {
          copilot: {
            cli: {
              source: 'managed',
              version: '1.0.36'
            },
            configContent: {
              nested: {
                project: true
              },
              keep: 'project'
            }
          }
        }
      }, {
        adapters: {
          copilot: {
            cli: {
              autoInstall: false,
              prepareOnInstall: true
            },
            configContent: {
              nested: {
                user: true
              }
            }
          }
        }
      }]
    })

    expect(resolveAdapterConfig(ctx)).toMatchObject({
      cli: {
        source: 'managed',
        version: '1.0.36',
        autoInstall: false,
        prepareOnInstall: true
      },
      configContent: {
        nested: {
          project: true,
          user: true
        },
        keep: 'project'
      }
    })
  })

  it('merges workspace trust into the managed Copilot settings by default', async () => {
    const cwd = await makeTempDir()
    const { ctx } = makeCtx({ cwd })
    const configDir = await ensureCopilotConfigDir(ctx, {})

    await writeFile(
      join(configDir, 'settings.json'),
      JSON.stringify(
        {
          trustedFolders: ['/existing/workspace'],
          allowed_urls: ['https://example.com']
        },
        null,
        2
      ),
      'utf8'
    )

    await ensureCopilotRuntimeSettings(
      ctx,
      {
        type: 'create',
        runtime: 'server',
        sessionId: 'session-trust',
        description: 'hello',
        onEvent: () => {}
      } as any,
      {},
      configDir
    )

    expect(JSON.parse(await readFile(join(configDir, 'settings.json'), 'utf8'))).toEqual({
      trusted_folders: ['/existing/workspace', cwd],
      allowed_urls: ['https://example.com']
    })
  })

  it('removes legacy config.json after migrating it into settings.json', async () => {
    const cwd = await makeTempDir()
    const { ctx } = makeCtx({
      cwd,
      env: {
        __VF_PROJECT_AI_COPILOT_NATIVE_HOOKS_AVAILABLE__: '0'
      }
    })
    const configDir = await ensureCopilotConfigDir(ctx, {})
    const legacyConfigPath = join(configDir, 'config.json')
    await mkdir(configDir, { recursive: true })
    await writeFile(
      legacyConfigPath,
      JSON.stringify({
        trustedFolders: ['/legacy/workspace'],
        allowed_urls: ['https://example.com']
      }),
      'utf8'
    )

    await ensureCopilotRuntimeSettings(
      ctx,
      {
        type: 'create',
        runtime: 'server',
        sessionId: 'session-legacy-config',
        onEvent: () => {}
      } as any,
      {},
      configDir
    )

    await expect(readFile(legacyConfigPath, 'utf8')).rejects.toThrow()
    expect(JSON.parse(await readFile(join(configDir, 'settings.json'), 'utf8'))).toEqual({
      trusted_folders: ['/legacy/workspace', cwd],
      allowed_urls: ['https://example.com']
    })
  })
})
