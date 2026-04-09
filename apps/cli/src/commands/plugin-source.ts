import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { ManagedPluginSource } from '@vibe-forge/types'

export interface ClaudePluginManifest {
  name?: string
  skills?: string | string[]
  commands?: string | string[]
  agents?: string | string[]
  hooks?: string | string[] | Record<string, unknown>
  mcpServers?: string | string[] | Record<string, unknown>
  userConfig?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

export const pathExists = async (target: string) => {
  try {
    await fs.access(target, constants.F_OK)
    return true
  } catch {
    return false
  }
}

const runProcess = async (command: string, args: string[], options?: { cwd?: string }) => {
  const result = await new Promise<{
    code: number
    stdout: string
    stderr: string
  }>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => {
      stdout += String(chunk)
    })
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', code => {
      resolvePromise({
        code: code ?? 1,
        stdout,
        stderr
      })
    })
  })

  if (result.code !== 0) {
    const message = result.stderr.trim() || `${command} exited with code ${result.code}.`
    throw new Error(message)
  }

  return result
}

export const parseClaudePluginManifest = async (pluginRoot: string): Promise<ClaudePluginManifest | undefined> => {
  const manifestPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json')
  if (!await pathExists(manifestPath)) return undefined

  const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as unknown
  return isRecord(raw) ? raw as ClaudePluginManifest : undefined
}

export const detectClaudePluginRoot = async (baseDir: string): Promise<string> => {
  const candidates = [baseDir, path.join(baseDir, 'package')]

  for (const candidate of candidates) {
    if (
      await pathExists(path.join(candidate, '.claude-plugin', 'plugin.json')) ||
      await pathExists(path.join(candidate, 'skills')) ||
      await pathExists(path.join(candidate, 'commands')) ||
      await pathExists(path.join(candidate, 'agents')) ||
      await pathExists(path.join(candidate, 'hooks')) ||
      await pathExists(path.join(candidate, '.mcp.json'))
    ) {
      return candidate
    }
  }

  const entries = await fs.readdir(baseDir, { withFileTypes: true })
  const onlyDir = entries.find(entry => entry.isDirectory())
  if (entries.length === 1 && onlyDir != null) {
    return detectClaudePluginRoot(path.join(baseDir, onlyDir.name))
  }

  throw new Error('The installed source does not look like a Claude Code plugin.')
}

export const resolveClaudeSource = async (cwd: string, value: string): Promise<ManagedPluginSource> => {
  const trimmed = value.trim()
  const localPath = path.resolve(cwd, trimmed)
  if (trimmed.startsWith('.') || trimmed.startsWith('/') || await pathExists(localPath)) {
    return {
      type: 'path',
      path: trimmed
    }
  }

  if (trimmed.startsWith('github:')) {
    const [repo, ref] = trimmed.slice('github:'.length).split('#')
    return {
      type: 'github',
      repo,
      ...(ref != null && ref !== '' ? { ref } : {})
    }
  }

  if (
    trimmed.startsWith('git+') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('ssh://') ||
    trimmed.endsWith('.git')
  ) {
    const [url, ref] = trimmed.replace(/^git\+/, '').split('#')
    return {
      type: 'git',
      url,
      ...(ref != null && ref !== '' ? { ref } : {})
    }
  }

  if (!trimmed.startsWith('@') && /^[^/\s]+\/[^#\s]+(?:#.+)?$/.test(trimmed)) {
    const [repo, ref] = trimmed.split('#')
    return {
      type: 'github',
      repo,
      ...(ref != null && ref !== '' ? { ref } : {})
    }
  }

  return {
    type: 'npm',
    spec: trimmed
  }
}

export const installClaudePluginSource = async (
  tempDir: string,
  cwd: string,
  source: ManagedPluginSource
) => {
  if (source.type === 'npm') {
    const packResult = await runProcess('npm', [
      'pack',
      source.spec,
      '--json',
      '--pack-destination',
      tempDir
    ])
    const parsed = JSON.parse(packResult.stdout) as Array<{ filename?: string }>
    const archiveName = parsed[0]?.filename
    if (archiveName == null) {
      throw new Error(`Failed to pack npm source ${source.spec}.`)
    }

    const archivePath = path.join(tempDir, archiveName)
    const extractDir = path.join(tempDir, 'extract')
    await fs.mkdir(extractDir, { recursive: true })
    await runProcess('tar', ['-xzf', archivePath, '-C', extractDir])
    return extractDir
  }

  if (source.type === 'path') {
    const target = path.join(tempDir, 'local')
    await fs.cp(path.resolve(cwd, source.path), target, { recursive: true })
    return target
  }

  const checkoutDir = path.join(tempDir, 'checkout')
  const url = source.type === 'github'
    ? `https://github.com/${source.repo}.git`
    : source.url

  await runProcess('git', [
    'clone',
    '--depth',
    '1',
    ...(source.ref != null ? ['--branch', source.ref] : []),
    url,
    checkoutDir
  ])
  await fs.rm(path.join(checkoutDir, '.git'), { recursive: true, force: true })
  return checkoutDir
}
