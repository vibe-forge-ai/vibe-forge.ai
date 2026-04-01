import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import fg from 'fast-glob'
import { afterEach, describe, expect, it } from 'vitest'

import { callHook } from '#~/call.js'

const tempDirs: string[] = []

const writeDocument = async (filePath: string, content: string) => {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content)
}

const installLoggerPluginPackage = async (workspace: string) => {
  const packageDir = join(workspace, 'node_modules', '@vibe-forge', 'plugin-logger')
  await Promise.all([
    writeDocument(join(packageDir, 'package.json'), JSON.stringify({
      name: '@vibe-forge/plugin-logger',
      version: '1.0.0'
    }, null, 2)),
    writeDocument(join(packageDir, 'hooks.js'), [
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
    ].join('\n'))
  ])
}

afterEach(async () => {
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
})
