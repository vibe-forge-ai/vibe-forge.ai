import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { installClaudePlugin } from '#~/commands/plugin.js'

const tempDirs: string[] = []

const createTempDir = async () => {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'vf-plugin-'))
  tempDirs.push(cwd)
  return cwd
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })))
})

describe('plugin command', () => {
  it('installs a local Claude plugin into .ai/plugins and generates Vibe Forge assets', async () => {
    const cwd = await createTempDir()
    const pluginSourceDir = path.join(cwd, 'local-claude-plugin')

    await fs.mkdir(path.join(pluginSourceDir, '.claude-plugin'), { recursive: true })
    await fs.mkdir(path.join(pluginSourceDir, 'skills', 'research'), { recursive: true })
    await fs.mkdir(path.join(pluginSourceDir, 'commands'), { recursive: true })
    await fs.mkdir(path.join(pluginSourceDir, 'agents'), { recursive: true })
    await fs.mkdir(path.join(pluginSourceDir, 'hooks'), { recursive: true })

    await fs.writeFile(
      path.join(pluginSourceDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'Demo Claude Plugin' }, null, 2)
    )
    await fs.writeFile(
      path.join(pluginSourceDir, 'skills', 'research', 'SKILL.md'),
      'Use ${' + 'CLAUDE_PLUGIN_ROOT} and ${' + 'CLAUDE_PLUGIN_DATA}\n'
    )
    await fs.writeFile(path.join(pluginSourceDir, 'commands', 'review.md'), 'Review changed files\n')
    await fs.writeFile(path.join(pluginSourceDir, 'agents', 'reviewer.md'), 'Review the implementation\n')
    await fs.writeFile(
      path.join(pluginSourceDir, '.mcp.json'),
      JSON.stringify({
        mcpServers: {
          docs: {
            command: '${' + 'CLAUDE_PLUGIN_ROOT}/server.js',
            args: ['--data', '${' + 'CLAUDE_PLUGIN_DATA}']
          }
        }
      }, null, 2)
    )
    await fs.writeFile(
      path.join(pluginSourceDir, 'hooks', 'hooks.json'),
      JSON.stringify({
        hooks: {
          SessionStart: [{
            hooks: [{
              type: 'command',
              command: '"${' + 'CLAUDE_PLUGIN_ROOT}/scripts/hook.sh"'
            }]
          }]
        }
      }, null, 2)
    )

    const result = await installClaudePlugin({
      cwd,
      source: pluginSourceDir
    })

    expect(result.config.name).toBe('Demo Claude Plugin')

    const installRoot = path.join(cwd, '.ai', 'plugins', 'demo-claude-plugin')
    const nativePluginRoot = path.join(installRoot, 'native')
    const pluginDataRoot = path.join(installRoot, 'data')
    await expect(fs.readFile(path.join(installRoot, '.vf-plugin.json'), 'utf8')).resolves.toContain('"adapter": "claude"')
    await expect(fs.readFile(path.join(installRoot, 'native', '.claude-plugin', 'plugin.json'), 'utf8')).resolves
      .toContain('Demo Claude Plugin')
    await expect(fs.readFile(path.join(installRoot, 'vibe-forge', 'skills', 'research', 'SKILL.md'), 'utf8')).resolves
      .toContain(`Use ${nativePluginRoot} and ${pluginDataRoot}`)
    await expect(fs.readFile(path.join(installRoot, 'vibe-forge', 'skills', 'review', 'SKILL.md'), 'utf8')).resolves
      .toContain('Review changed files')
    await expect(
      fs.readFile(path.join(installRoot, 'vibe-forge', 'entities', 'reviewer', 'README.md'), 'utf8')
    ).resolves.toContain('Review the implementation')
    await expect(fs.readFile(path.join(installRoot, 'vibe-forge', 'mcp', 'docs.json'), 'utf8')).resolves
      .toContain(`${nativePluginRoot}/server.js`)
    await expect(fs.readFile(path.join(installRoot, 'vibe-forge', 'mcp', 'docs.json'), 'utf8')).resolves
      .toContain(pluginDataRoot)
    await expect(fs.readFile(path.join(installRoot, 'vibe-forge', 'mcp', 'docs.json'), 'utf8')).resolves
      .toContain('"CLAUDE_PLUGIN_ROOT"')
    await expect(fs.readFile(path.join(installRoot, 'vibe-forge', 'hooks', 'claude-hooks.json'), 'utf8')).resolves
      .toContain('${' + 'CLAUDE_PLUGIN_ROOT}/scripts/hook.sh')
    await expect(fs.readFile(path.join(installRoot, 'vibe-forge', 'hooks.js'), 'utf8')).resolves
      .toContain('claudePluginRoot')
    await expect(fs.stat(pluginDataRoot)).resolves.toEqual(expect.objectContaining({ isDirectory: expect.any(Function) }))
  })

  it('rejects Claude plugins that require userConfig mapping', async () => {
    const cwd = await createTempDir()
    const pluginSourceDir = path.join(cwd, 'plugin-with-user-config')

    await fs.mkdir(path.join(pluginSourceDir, '.claude-plugin'), { recursive: true })
    await fs.writeFile(
      path.join(pluginSourceDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name: 'Plugin With Config',
        userConfig: {
          api_token: {
            description: 'Token',
            sensitive: true
          }
        }
      }, null, 2)
    )

    await expect(installClaudePlugin({
      cwd,
      source: pluginSourceDir
    })).rejects.toThrow(/userConfig/i)
  })

  it('rejects unsupported Claude hook events during conversion', async () => {
    const cwd = await createTempDir()
    const pluginSourceDir = path.join(cwd, 'plugin-with-unsupported-hook')

    await fs.mkdir(path.join(pluginSourceDir, 'hooks'), { recursive: true })
    await fs.writeFile(
      path.join(pluginSourceDir, 'hooks', 'hooks.json'),
      JSON.stringify({
        hooks: {
          PermissionRequest: [{
            hooks: [{
              type: 'command',
              command: 'echo nope'
            }]
          }]
        }
      }, null, 2)
    )

    await expect(installClaudePlugin({
      cwd,
      source: pluginSourceDir
    })).rejects.toThrow(/Unsupported Claude hook event/i)
  })

  it('rejects colliding Claude skill and command names during conversion', async () => {
    const cwd = await createTempDir()
    const pluginSourceDir = path.join(cwd, 'plugin-with-collision')

    await fs.mkdir(path.join(pluginSourceDir, '.claude-plugin'), { recursive: true })
    await fs.mkdir(path.join(pluginSourceDir, 'skills', 'review'), { recursive: true })
    await fs.mkdir(path.join(pluginSourceDir, 'commands'), { recursive: true })
    await fs.writeFile(
      path.join(pluginSourceDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'Retryable Plugin' }, null, 2)
    )
    await fs.writeFile(path.join(pluginSourceDir, 'skills', 'review', 'SKILL.md'), 'Review docs\n')
    await fs.writeFile(path.join(pluginSourceDir, 'commands', 'review.md'), 'Review files\n')

    await expect(installClaudePlugin({
      cwd,
      source: pluginSourceDir
    })).rejects.toThrow(/assets conflict/i)

    await expect(fs.access(path.join(cwd, '.ai', 'plugins', 'retryable-plugin'))).rejects.toThrow()

    await fs.rm(path.join(pluginSourceDir, 'commands', 'review.md'))
    await fs.writeFile(path.join(pluginSourceDir, 'commands', 'review-command.md'), 'Review files\n')

    await expect(installClaudePlugin({
      cwd,
      source: pluginSourceDir
    })).resolves.toEqual(expect.objectContaining({
      installDir: path.join(cwd, '.ai', 'plugins', 'retryable-plugin')
    }))
  })
})
