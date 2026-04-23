/* eslint-disable regexp/no-super-linear-backtracking, regexp/no-useless-non-capturing-group, regexp/no-useless-quantifier -- ANSI stripping pattern intentionally mirrors terminal escape sequences. */
import { execFile } from 'node:child_process'

import type { SkillsCliConfig } from '@vibe-forge/types'

const stripAnsiPattern = new RegExp(
  [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\\u0007))',
    '(?:\\u001B\\][^\\u0007]*(?:\\u0007|\\u001B\\\\))',
    '(?:[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~])'
  ].join('|'),
  'gu'
)

export const DEFAULT_MAX_BUFFER = 1024 * 1024 * 20

export const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

export const parseFrontmatterValue = (body: string, key: 'description' | 'name') => {
  const lines = body.split('\n')
  if (lines[0]?.trim() !== '---') return undefined

  for (const line of lines.slice(1)) {
    if (line.trim() === '---') break
    const separatorIndex = line.indexOf(':')
    if (separatorIndex <= 0) continue
    if (line.slice(0, separatorIndex).trim() !== key) continue
    const value = line.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')
    return value === '' ? undefined : value
  }

  return undefined
}

export const stripAnsi = (value: string) => value.replace(stripAnsiPattern, '')

export const toSkillsCliError = (error: unknown) => {
  const stdout = error instanceof Error && 'stdout' in error
    ? String((error as { stdout?: string }).stdout ?? '')
    : ''
  const stderr = error instanceof Error && 'stderr' in error
    ? String((error as { stderr?: string }).stderr ?? '')
    : ''
  const detail = [stdout, stderr]
    .map(chunk => stripAnsi(chunk).trim())
    .filter(Boolean)
    .join('\n')

  return new Error(detail !== '' ? detail : (error instanceof Error ? error.message : String(error)))
}

export const toSkillSlug = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
)

export const resolveSkillsCliRegistry = (params: {
  config?: SkillsCliConfig
  registry?: string
}) => (
  normalizeNonEmptyString(params.registry) ??
    normalizeNonEmptyString(params.config?.registry) ??
    normalizeNonEmptyString(params.config?.npmRegistry)
)

export const buildSkillsCliEnv = (params: {
  config?: SkillsCliConfig
  registry?: string
}) => ({
  ...Object.fromEntries(
    Object.entries(params.config?.env ?? {})
      .filter((item): item is [string, string] => typeof item[1] === 'string')
  ),
  ...(resolveSkillsCliRegistry(params) != null
    ? { npm_config_registry: resolveSkillsCliRegistry(params) }
    : {})
})

export const toCacheKey = (params: {
  config?: SkillsCliConfig
  input: string
  registry?: string
}) =>
  JSON.stringify({
    input: params.input,
    package: params.config?.package ?? 'skills',
    version: params.config?.version ?? 'latest',
    registry: resolveSkillsCliRegistry({
      config: params.config,
      registry: params.registry
    }) ?? '',
    env: params.config?.env ?? {}
  })

export const toInstallKey = (params: {
  config?: SkillsCliConfig
  registry?: string
}) => {
  const registry = resolveSkillsCliRegistry(params)
  return registry == null ? undefined : ['registry', registry]
}

export const execFileAsync = (
  file: string,
  args: string[],
  options: {
    cwd: string
    env: NodeJS.ProcessEnv
    maxBuffer: number
  }
) =>
  new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error != null) {
        reject(Object.assign(error, {
          stderr,
          stdout
        }))
        return
      }

      resolve({
        stderr,
        stdout
      })
    })
  })
