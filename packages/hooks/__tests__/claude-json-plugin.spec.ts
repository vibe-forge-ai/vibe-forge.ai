import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createClaudeJsonHooksPlugin } from '#~/claude-json-plugin.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('createClaudeJsonHooksPlugin', () => {
  it('executes declarative Claude command hooks and maps the JSON result back to a hook output', async () => {
    const pluginDir = await mkdtemp(join(tmpdir(), 'vf-claude-json-plugin-'))
    tempDirs.push(pluginDir)

    await mkdir(join(pluginDir, 'hooks'), { recursive: true })
    await writeFile(
      join(pluginDir, 'hooks', 'claude-hooks.json'),
      JSON.stringify({
        hooks: {
          SessionStart: [{
            hooks: [{
              type: 'command',
              command: 'node -e "process.stdout.write(JSON.stringify({systemMessage:[process.env.CLAUDE_PLUGIN_ROOT,process.env.CLAUDE_PLUGIN_DATA].join(\\\"|\\\")}))"'
            }]
          }]
        }
      }, null, 2)
    )

    const plugin = createClaudeJsonHooksPlugin({
      name: 'demo',
      pluginDir,
      configPath: './hooks/claude-hooks.json',
      claudePluginRoot: '/tmp/native-plugin',
      pluginDataDir: '/tmp/plugin-data'
    })

    const result = await plugin.SessionStart?.(
      {
        logger: {
          stream: process.stdout,
          info: () => {},
          warn: () => {},
          error: () => {},
          debug: () => {}
        }
      },
      {
        cwd: pluginDir,
        sessionId: 'session-1',
        hookEventName: 'SessionStart',
        source: 'startup'
      },
      async () => ({ continue: true })
    )

    expect(result).toEqual(expect.objectContaining({
      continue: true,
      systemMessage: '/tmp/native-plugin|/tmp/plugin-data'
    }))
  })

  it('supports SessionEnd declarative Claude hooks', async () => {
    const pluginDir = await mkdtemp(join(tmpdir(), 'vf-claude-json-plugin-'))
    tempDirs.push(pluginDir)

    await mkdir(join(pluginDir, 'hooks'), { recursive: true })
    await writeFile(
      join(pluginDir, 'hooks', 'claude-hooks.json'),
      JSON.stringify({
        hooks: {
          SessionEnd: [{
            hooks: [{
              type: 'command',
              command: 'node -e "process.stdout.write(JSON.stringify({systemMessage:\\\"session-end\\\"}))"'
            }]
          }]
        }
      }, null, 2)
    )

    const plugin = createClaudeJsonHooksPlugin({
      name: 'demo',
      pluginDir,
      configPath: './hooks/claude-hooks.json',
      claudePluginRoot: '/tmp/native-plugin',
      pluginDataDir: '/tmp/plugin-data'
    })

    const result = await plugin.SessionEnd?.(
      {
        logger: {
          stream: process.stdout,
          info: () => {},
          warn: () => {},
          error: () => {},
          debug: () => {}
        }
      },
      {
        cwd: pluginDir,
        sessionId: 'session-2',
        hookEventName: 'SessionEnd',
        reason: 'finished'
      },
      async () => ({ continue: true })
    )

    expect(result).toEqual(expect.objectContaining({
      continue: true,
      systemMessage: 'session-end'
    }))
  })
})
