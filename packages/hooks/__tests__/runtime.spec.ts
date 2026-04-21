import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { resolvePermissionMirrorPath } from '@vibe-forge/utils'
import fg from 'fast-glob'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { callHook } from '#~/call.js'

const tempDirs: string[] = []

const writeDocument = async (filePath: string, content: string) => {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content)
}

const installLoggerPluginPackage = async (workspace: string) => {
  const packageDir = join(workspace, 'node_modules', '@vibe-forge', 'plugin-logger')
  await Promise.all([
    writeDocument(
      join(packageDir, 'package.json'),
      JSON.stringify(
        {
          name: '@vibe-forge/plugin-logger',
          version: '1.0.0'
        },
        null,
        2
      )
    ),
    writeDocument(
      join(packageDir, 'hooks.js'),
      [
        'const REDACTED = "[REDACTED]"',
        'const SENSITIVE = /api[-_]?key|token|secret|authorization|password|cookie|session[-_]?token|bearer/i',
        'const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {})',
        'const sanitizeEnv = (value) => ({ redacted: true, count: Object.keys(asRecord(value)).length, keys: Object.keys(asRecord(value)).sort() })',
        'const sanitize = (value, key, seen = new WeakSet()) => {',
        '  if (key === "env") return sanitizeEnv(value)',
        '  if (key && SENSITIVE.test(key)) return REDACTED',
        '  if (Array.isArray(value)) return value.map((item) => sanitize(item, undefined, seen))',
        '  if (value && typeof value === "object") {',
        '    if (seen.has(value)) return "[Circular]"',
        '    seen.add(value)',
        '    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitize(entryValue, entryKey, seen)]))',
        '  }',
        '  return value',
        '}',
        'module.exports = {',
        '  name: "logger",',
        '  TaskStart: async ({ logger }, input, next) => {',
        '    logger.info(sanitize(input))',
        '    return next()',
        '  }',
        '}',
        ''
      ].join('\n')
    )
  ])
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('hook runtime', () => {
  it('executes hooks locally without requiring the server route', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-'))
    tempDirs.push(workspace)
    await installLoggerPluginPackage(workspace)

    await writeFile(
      join(workspace, '.ai.config.json'),
      JSON.stringify({
        plugins: [
          {
            id: 'logger'
          }
        ]
      })
    )

    const result = await callHook(
      'TaskStart',
      {
        cwd: workspace,
        sessionId: 'session-1',
        adapter: 'codex',
        options: { cwd: workspace },
        adapterOptions: { sessionId: 'session-1', runtime: 'cli', type: 'create' }
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-local-hook',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(result).toEqual({ continue: true })

    const logFiles = await fg('.ai/logs/ctx-local-hook/**/*.log.md', {
      cwd: workspace,
      absolute: true
    })
    expect(logFiles).toHaveLength(1)

    const logContent = await readFile(logFiles[0], 'utf-8')
    expect(logContent).toContain('[TaskStart]')
    expect(logContent).toContain('[plugin.logger]')
  })

  it('formats plugin logger payloads as yaml with folded multiline strings', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-yaml-'))
    tempDirs.push(workspace)
    await installLoggerPluginPackage(workspace)

    await writeFile(
      join(workspace, '.ai.config.json'),
      JSON.stringify({
        plugins: [
          {
            id: 'logger'
          }
        ]
      })
    )

    const result = await callHook(
      'TaskStart',
      {
        cwd: workspace,
        sessionId: 'session-yaml',
        adapter: 'codex',
        options: { cwd: workspace },
        adapterOptions: {
          sessionId: 'session-yaml',
          runtime: 'cli',
          type: 'create',
          systemPrompt: '1233\n456'
        }
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-yaml-hook',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(result).toEqual({ continue: true })

    const logFiles = await fg('.ai/logs/ctx-yaml-hook/**/*.log.md', {
      cwd: workspace,
      absolute: true
    })
    expect(logFiles).toHaveLength(1)

    const logContent = await readFile(logFiles[0], 'utf-8')
    expect(logContent).toContain('[TaskStart]')
    expect(logContent).toContain('[plugin.logger]')
    expect(logContent).toContain('```yaml')
    expect(logContent).toContain('adapterOptions:')
    expect(logContent).toContain('  systemPrompt: >-')
    expect(logContent).toContain('    1233')
    expect(logContent).toContain('    456')
  })

  it('skips plugins that are explicitly disabled in config', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-disabled-'))
    tempDirs.push(workspace)
    await installLoggerPluginPackage(workspace)

    await writeFile(
      join(workspace, '.ai.config.json'),
      JSON.stringify({
        plugins: [
          {
            id: 'logger',
            enabled: false
          }
        ]
      })
    )

    const result = await callHook(
      'TaskStart',
      {
        cwd: workspace,
        sessionId: 'session-disabled',
        adapter: 'codex',
        options: { cwd: workspace },
        adapterOptions: { sessionId: 'session-disabled', runtime: 'cli', type: 'create' }
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-disabled-hook',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(result).toEqual({ continue: true })

    const logFiles = await fg('.ai/logs/ctx-disabled-hook/**/*.log.md', {
      cwd: workspace,
      absolute: true
    })
    expect(logFiles).toHaveLength(1)

    const logContent = await readFile(logFiles[0], 'utf-8')
    expect(logContent).not.toContain('[plugin.logger]')
  })

  it('continues without loading plugins when the config file cannot be parsed', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-legacy-'))
    tempDirs.push(workspace)

    await writeFile(
      join(workspace, '.ai.config.json'),
      JSON.stringify({
        plugins: {
          logger: {}
        }
      })
    )

    const result = await callHook(
      'TaskStart',
      {
        cwd: workspace,
        sessionId: 'session-2',
        adapter: 'codex',
        options: { cwd: workspace },
        adapterOptions: { sessionId: 'session-2', runtime: 'cli', type: 'create' }
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-legacy-hook',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(result).toEqual({ continue: true })

    const logFiles = await fg('.ai/logs/ctx-legacy-hook/**/*.log.md', {
      cwd: workspace,
      absolute: true
    })
    expect(logFiles).toHaveLength(1)

    const logContent = await readFile(logFiles[0], 'utf-8')
    expect(logContent).not.toContain('[plugin.logger]')
  })

  it('redacts secrets from logger hook output', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-redact-'))
    tempDirs.push(workspace)
    await installLoggerPluginPackage(workspace)

    await writeFile(
      join(workspace, '.ai.config.json'),
      JSON.stringify({
        plugins: [
          {
            id: 'logger'
          }
        ]
      })
    )

    const secretApiKey = 'sk-live-redaction-test'
    const secretToken = 'bearer-super-secret'

    const result = await callHook(
      'TaskStart',
      {
        cwd: workspace,
        sessionId: 'session-redact',
        adapter: 'codex',
        options: {
          env: {
            OPENAI_API_KEY: secretApiKey,
            SAFE_VALUE: 'visible'
          }
        },
        adapterOptions: {
          token: secretToken,
          nested: {
            authorization: 'Bearer nested-secret'
          }
        }
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-redact-hook',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(result).toEqual({ continue: true })

    const logFiles = await fg('.ai/logs/ctx-redact-hook/**/*.log.md', {
      cwd: workspace,
      absolute: true
    })
    expect(logFiles).toHaveLength(1)

    const logContent = await readFile(logFiles[0], 'utf-8')
    expect(logContent).toContain('[REDACTED]')
    expect(logContent).toContain('OPENAI_API_KEY')
    expect(logContent).not.toContain(secretApiKey)
    expect(logContent).not.toContain(secretToken)
    expect(logContent).not.toContain('nested-secret')
  })

  it('returns a remembered deny decision from the builtin permission plugin mirror fallback', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-permission-deny-'))
    tempDirs.push(workspace)

    await writeDocument(
      resolvePermissionMirrorPath(workspace, 'claude-code', 'session-deny'),
      JSON.stringify({
        permissionState: {
          allow: [],
          deny: ['Write'],
          onceAllow: [],
          onceDeny: []
        },
        projectPermissions: {
          allow: [],
          deny: [],
          ask: []
        }
      })
    )

    const result = await callHook(
      'PreToolUse',
      {
        cwd: workspace,
        sessionId: 'session-deny',
        adapter: 'claude-code',
        runtime: 'server',
        hookSource: 'native',
        canBlock: true,
        toolName: 'write'
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-permission-deny',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(result).toMatchObject({
      continue: false,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny'
      }
    })
  })

  it('returns remembered permission decisions for Kimi native hooks', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-permission-kimi-'))
    tempDirs.push(workspace)

    await writeDocument(
      resolvePermissionMirrorPath(workspace, 'kimi', 'session-kimi-deny'),
      JSON.stringify({
        permissionState: {
          allow: [],
          deny: ['Shell'],
          onceAllow: [],
          onceDeny: []
        },
        projectPermissions: {
          allow: [],
          deny: [],
          ask: []
        }
      })
    )

    const result = await callHook(
      'PreToolUse',
      {
        cwd: workspace,
        sessionId: 'session-kimi-deny',
        adapter: 'kimi',
        runtime: 'cli',
        hookSource: 'native',
        canBlock: true,
        toolName: 'Shell'
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-permission-kimi-deny',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(result).toMatchObject({
      continue: false,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny'
      }
    })
  })

  it('returns remembered permission decisions for Gemini native hooks', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-permission-gemini-'))
    tempDirs.push(workspace)

    await writeDocument(
      resolvePermissionMirrorPath(workspace, 'gemini', 'session-gemini-deny'),
      JSON.stringify({
        permissionState: {
          allow: [],
          deny: ['Shell'],
          onceAllow: [],
          onceDeny: []
        },
        projectPermissions: {
          allow: [],
          deny: [],
          ask: []
        }
      })
    )

    const result = await callHook(
      'PreToolUse',
      {
        cwd: workspace,
        sessionId: 'session-gemini-deny',
        adapter: 'gemini',
        runtime: 'cli',
        hookSource: 'native',
        canBlock: true,
        toolName: 'Shell'
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-permission-gemini-deny',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(result).toMatchObject({
      continue: false,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny'
      }
    })
  })

  it('returns a remembered allow decision from the builtin permission plugin mirror fallback', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-permission-allow-'))
    tempDirs.push(workspace)

    await writeDocument(
      resolvePermissionMirrorPath(workspace, 'claude-code', 'session-allow'),
      JSON.stringify({
        permissionState: {
          allow: ['Read'],
          deny: [],
          onceAllow: [],
          onceDeny: []
        },
        projectPermissions: {
          allow: [],
          deny: [],
          ask: []
        }
      })
    )

    const result = await callHook(
      'PreToolUse',
      {
        cwd: workspace,
        sessionId: 'session-allow',
        adapter: 'claude-code',
        runtime: 'server',
        hookSource: 'native',
        canBlock: true,
        toolName: 'read'
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-permission-allow',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(result).toMatchObject({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow'
      }
    })
  })

  it('normalizes mixed-case custom MCP keys in the builtin permission plugin mirror fallback', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-permission-custom-allow-'))
    tempDirs.push(workspace)

    await writeDocument(
      resolvePermissionMirrorPath(workspace, 'claude-code', 'session-custom-allow'),
      JSON.stringify({
        permissionState: {
          allow: ['Channel-lark-test'],
          deny: [],
          onceAllow: [],
          onceDeny: []
        },
        projectPermissions: {
          allow: [],
          deny: [],
          ask: []
        }
      })
    )

    const result = await callHook(
      'PreToolUse',
      {
        cwd: workspace,
        sessionId: 'session-custom-allow',
        adapter: 'claude-code',
        runtime: 'server',
        hookSource: 'native',
        canBlock: true,
        toolName: 'mcp__channel-lark-test__GetChannelContext'
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-permission-custom-allow',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(result).toMatchObject({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow'
      }
    })
  })

  it('consumes onceAllow decisions from the builtin permission plugin mirror fallback', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-permission-once-allow-'))
    tempDirs.push(workspace)
    const mirrorPath = resolvePermissionMirrorPath(workspace, 'claude-code', 'session-once-allow')

    await writeDocument(
      mirrorPath,
      JSON.stringify({
        permissionState: {
          allow: [],
          deny: [],
          onceAllow: ['Write'],
          onceDeny: []
        },
        projectPermissions: {
          allow: [],
          deny: [],
          ask: []
        }
      })
    )

    const first = await callHook(
      'PreToolUse',
      {
        cwd: workspace,
        sessionId: 'session-once-allow',
        adapter: 'claude-code',
        runtime: 'server',
        hookSource: 'native',
        canBlock: true,
        toolName: 'write'
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-permission-once-allow',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(first).toMatchObject({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow'
      }
    })

    const persisted = JSON.parse(await readFile(mirrorPath, 'utf8')) as {
      permissionState?: { onceAllow?: string[] }
    }
    expect(persisted.permissionState?.onceAllow ?? []).toEqual([])

    const second = await callHook(
      'PreToolUse',
      {
        cwd: workspace,
        sessionId: 'session-once-allow',
        adapter: 'claude-code',
        runtime: 'server',
        hookSource: 'native',
        canBlock: true,
        toolName: 'write'
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-permission-once-allow-second',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(second).toEqual({ continue: true })
  })

  it('checks the mirror after permission-check returns inherit for mcp tasks', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-permission-mcp-inherit-'))
    tempDirs.push(workspace)

    await writeDocument(
      resolvePermissionMirrorPath(workspace, 'claude-code', 'session-mcp-inherit'),
      JSON.stringify({
        permissionState: {
          allow: ['Write'],
          deny: [],
          onceAllow: [],
          onceDeny: []
        },
        projectPermissions: {
          allow: [],
          deny: [],
          ask: []
        }
      })
    )

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        result: 'inherit'
      })
    } as Response)

    const result = await callHook(
      'PreToolUse',
      {
        cwd: workspace,
        sessionId: 'session-mcp-inherit',
        adapter: 'claude-code',
        runtime: 'mcp',
        hookSource: 'native',
        canBlock: true,
        toolName: 'write'
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-permission-mcp-inherit',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '8787'
      }
    )

    expect(result).toMatchObject({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow'
      }
    })
  })

})
