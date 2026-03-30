import { access } from 'node:fs/promises'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runClearCommand } from '#~/commands/clear.js'

const tempDirs: string[] = []

const createTempDir = async () => {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), 'vf-clear-'))
  tempDirs.push(cwd)
  return cwd
}

const exists = async (target: string) => {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { force: true, recursive: true })))
})

describe('clear command', () => {
  it('clears logs and preserves claude-code-router config assets', async () => {
    const cwd = await createTempDir()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await fs.mkdir(path.join(cwd, '.logs/sub'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/logs'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/caches'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/benchmarks/specs/demo/logs'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.claude/debug'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.claude-code-router/logs'), { recursive: true })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.claude-code-router/20260330-0000-01-./logs'), {
      recursive: true
    })
    await fs.mkdir(path.join(cwd, '.ai/.mock/.claude-code-router/plugins'), { recursive: true })

    await fs.writeFile(path.join(cwd, '.logs/sub/task.log'), 'old log')
    await fs.writeFile(path.join(cwd, '.ai/logs/session.log'), 'session log')
    await fs.writeFile(path.join(cwd, '.ai/caches/cache.json'), '{"ok":true}')
    await fs.writeFile(path.join(cwd, '.ai/benchmarks/specs/demo/logs/run.log'), 'benchmark')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.claude/debug/debug.log'), 'debug')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.claude-code-router/logs/ccr-1.log'), 'router log')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.claude-code-router/claude-code-router.log'), 'root log')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.claude-code-router/.claude-code-router.pid'), '100')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.claude-code-router/config.json'), '{"router":true}')
    await fs.writeFile(path.join(cwd, '.ai/.mock/.claude-code-router/plugins/plugin.js'), 'export {}')
    await fs.writeFile(
      path.join(cwd, '.ai/.mock/.claude-code-router/20260330-0000-01-./logs/session.log'),
      'dated log'
    )

    await runClearCommand({ cwd })

    expect(await exists(path.join(cwd, '.logs'))).toBe(false)
    expect(await exists(path.join(cwd, '.ai/logs/session.log'))).toBe(false)
    expect(await exists(path.join(cwd, '.ai/caches/cache.json'))).toBe(false)
    expect(await exists(path.join(cwd, '.ai/benchmarks/specs/demo/logs'))).toBe(false)
    expect(await exists(path.join(cwd, '.ai/.mock/.claude/debug'))).toBe(false)
    expect(await exists(path.join(cwd, '.ai/.mock/.claude-code-router/logs'))).toBe(false)
    expect(await exists(path.join(cwd, '.ai/.mock/.claude-code-router/claude-code-router.log'))).toBe(false)
    expect(await exists(path.join(cwd, '.ai/.mock/.claude-code-router/20260330-0000-01-.'))).toBe(false)

    expect(await exists(path.join(cwd, '.ai/logs/.gitkeep'))).toBe(true)
    expect(await exists(path.join(cwd, '.ai/caches/.gitkeep'))).toBe(true)
    expect(await exists(path.join(cwd, '.ai/.mock/.claude-code-router/.claude-code-router.pid'))).toBe(true)
    expect(await exists(path.join(cwd, '.ai/.mock/.claude-code-router/config.json'))).toBe(true)
    expect(await exists(path.join(cwd, '.ai/.mock/.claude-code-router/plugins/plugin.js'))).toBe(true)
    expect(logSpy).toHaveBeenCalledWith('Clear logs and cache successfully')
  })
})
