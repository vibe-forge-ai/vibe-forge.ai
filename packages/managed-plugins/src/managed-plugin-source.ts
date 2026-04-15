import { spawn } from 'node:child_process'
import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { ManagedPluginSource } from '@vibe-forge/types'

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

const isGithubRepoShorthand = (value: string) => (
  !value.startsWith('http://') &&
  !value.startsWith('https://') &&
  !value.startsWith('ssh://') &&
  !value.startsWith('git@') &&
  /^[^/\s]+\/[^/\s]+$/.test(value)
)

const toGitUrl = (value: string) => (
  isGithubRepoShorthand(value)
    ? `https://github.com/${value}.git`
    : value
)

const cloneGitSource = async (
  tempDir: string,
  source: Extract<ManagedPluginSource, { type: 'github' | 'git' | 'git-subdir' }>
) => {
  const checkoutDir = path.join(tempDir, 'checkout')
  const url = source.type === 'github'
    ? `https://github.com/${source.repo}.git`
    : toGitUrl(source.url)
  await runProcess('git', [
    'clone',
    ...(source.sha == null ? ['--depth', '1'] : []),
    ...(source.ref != null && source.sha == null ? ['--branch', source.ref] : []),
    url,
    checkoutDir
  ])
  if (source.ref != null && source.sha != null) {
    await runProcess('git', ['checkout', source.ref], { cwd: checkoutDir })
  }
  if (source.sha != null) {
    await runProcess('git', ['checkout', source.sha], { cwd: checkoutDir })
  }
  await fs.rm(path.join(checkoutDir, '.git'), { recursive: true, force: true })
  if (source.type !== 'git-subdir') return checkoutDir

  const subdirPath = path.resolve(checkoutDir, source.path)
  const relativePath = path.relative(checkoutDir, subdirPath)
  if (
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    relativePath.startsWith('..\\') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Managed plugin git-subdir path "${source.path}" resolves outside the repository checkout.`)
  }
  if (!await pathExists(subdirPath)) {
    throw new Error(`Managed plugin git-subdir path "${source.path}" was not found in ${url}.`)
  }
  return subdirPath
}

export const installManagedPluginSource = async (
  tempDir: string,
  cwd: string,
  source: ManagedPluginSource
) => {
  await fs.mkdir(tempDir, { recursive: true })
  if (source.type === 'npm') {
    const packResult = await runProcess('npm', [
      'pack',
      source.spec,
      '--json',
      ...(source.registry != null ? ['--registry', source.registry] : []),
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
  if (source.type === 'marketplace') {
    throw new TypeError('Managed marketplace sources must be resolved before installation.')
  }
  return cloneGitSource(tempDir, source)
}

export const resolveManagedPluginSource = async (
  cwd: string,
  value: string
): Promise<ManagedPluginSource> => {
  const trimmed = value.trim()
  if (trimmed.startsWith('npm:')) {
    const spec = trimmed.slice('npm:'.length).trim()
    if (spec === '') {
      throw new Error('Managed plugin npm sources must include a package spec after "npm:".')
    }
    return {
      type: 'npm',
      spec
    }
  }
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
