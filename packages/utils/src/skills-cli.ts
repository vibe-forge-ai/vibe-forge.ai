/* eslint-disable no-control-regex, regexp/no-super-linear-backtracking, regexp/no-useless-lazy, regexp/no-useless-non-capturing-group, regexp/no-useless-quantifier -- CLI output parsing needs ANSI-stripping and permissive terminal patterns */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path, { join } from 'node:path'
import process from 'node:process'

import type { SkillsCliConfig } from '@vibe-forge/types'

import { ensureManagedNpmCli } from './managed-npm-cli'

const DEFAULT_MAX_BUFFER = 1024 * 1024 * 20
const FIND_CACHE_TTL_MS = 60 * 1000
const LIST_CACHE_TTL_MS = 5 * 60 * 1000
const stripAnsiPattern = new RegExp(
  [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\\u0007))',
    '(?:\\u001B\\][^\\u0007]*(?:\\u0007|\\u001B\\\\))',
    '(?:[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~])'
  ].join('|'),
  'gu'
)

const findCache = new Map<string, {
  expiresAt: number
  results: SkillsCliFindResult[]
}>()
const listCache = new Map<string, {
  expiresAt: number
  results: SkillsCliListedSkill[]
}>()

export interface SkillsCliListedSkill {
  description?: string
  name: string
}

export interface SkillsCliFindResult {
  installRef: string
  source: string
  skill: string
  installsLabel?: string
  url?: string
}

export interface InstalledSkillsCliSkill {
  description?: string
  dirName: string
  name: string
  sourcePath: string
}

export interface PublishSkillsCliResult {
  output: string
  stderr: string
  stdout: string
}

const normalizeNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const parseFrontmatterValue = (body: string, key: 'description' | 'name') => {
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

const toCacheKey = (params: {
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

const toInstallKey = (params: {
  config?: SkillsCliConfig
  registry?: string
}) => {
  const registry = resolveSkillsCliRegistry(params)
  return registry == null ? undefined : ['registry', registry]
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

export const resolveSkillsCliBinaryPath = async (params: {
  config?: SkillsCliConfig
  cwd: string
  registry?: string
}) => {
  const cliEnv = buildSkillsCliEnv({
    config: params.config,
    registry: params.registry
  })
  return ensureManagedNpmCli({
    adapterKey: 'skills_cli',
    binaryName: 'skills',
    cwd: params.cwd,
    env: cliEnv,
    installKey: toInstallKey({
      config: params.config,
      registry: params.registry
    }),
    config: {
      source: 'managed',
      ...(params.config?.source != null ? { source: params.config.source } : {}),
      ...(params.config?.path != null ? { path: params.config.path } : {}),
      ...(params.config?.package != null ? { package: params.config.package } : {}),
      ...(params.config?.version != null ? { version: params.config.version } : {}),
      ...(params.config?.autoInstall != null ? { autoInstall: params.config.autoInstall } : {}),
      ...(params.config?.prepareOnInstall != null ? { prepareOnInstall: params.config.prepareOnInstall } : {}),
      ...(params.config?.npmPath != null ? { npmPath: params.config.npmPath } : {})
    },
    defaultPackageName: 'skills',
    defaultVersion: 'latest',
    logger: {
      info: () => {}
    }
  })
}

export const runSkillsCli = async (params: {
  args: string[]
  config?: SkillsCliConfig
  cwd: string
  registry?: string
}) => {
  const binaryPath = await resolveSkillsCliBinaryPath({
    config: params.config,
    cwd: params.cwd,
    registry: params.registry
  })
  const env = {
    ...process.env,
    ...buildSkillsCliEnv({
      config: params.config,
      registry: params.registry
    }),
    CI: '1',
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    TERM: 'dumb'
  }

  return await execFileAsync(binaryPath, params.args, {
    cwd: params.cwd,
    env,
    maxBuffer: DEFAULT_MAX_BUFFER
  })
}

export const parseSkillsCliListOutput = (output: string): SkillsCliListedSkill[] => {
  const lines = stripAnsi(output)
    .split(/\r?\n/)
    .map(line => line.replace(/\u0008/g, '').trimEnd())
  const listedSkills: SkillsCliListedSkill[] = []
  let currentSkill: SkillsCliListedSkill | undefined
  let inAvailableSection = false

  const pushCurrentSkill = () => {
    if (currentSkill == null) return
    listedSkills.push({
      name: currentSkill.name,
      ...(normalizeNonEmptyString(currentSkill.description) != null
        ? { description: normalizeNonEmptyString(currentSkill.description) }
        : {})
    })
    currentSkill = undefined
  }

  for (const line of lines) {
    const plainEntryMatch = line.match(/^\s{2}(\S.+?)\s+-\s+(.+)$/)
    if (plainEntryMatch != null) {
      pushCurrentSkill()
      listedSkills.push({
        name: plainEntryMatch[1].trim(),
        description: plainEntryMatch[2].trim()
      })
      continue
    }

    if (!inAvailableSection) {
      if (line.includes('Available Skills')) {
        inAvailableSection = true
      }
      continue
    }

    if (line.includes('Use --skill <name>')) break
    const fancyNameMatch = line.match(/^\s*│\s{4}(\S.*)$/)
    if (fancyNameMatch != null) {
      pushCurrentSkill()
      currentSkill = { name: fancyNameMatch[1].trim() }
      continue
    }

    const fancyDescriptionMatch = line.match(/^\s*│\s{6}(.+)$/)
    if (fancyDescriptionMatch != null) {
      if (currentSkill == null) continue
      currentSkill.description = currentSkill.description == null
        ? fancyDescriptionMatch[1].trim()
        : `${currentSkill.description} ${fancyDescriptionMatch[1].trim()}`
      continue
    }

    if (line.trim() === '' || line.trim() === '│') continue
  }

  pushCurrentSkill()
  return listedSkills
}

export const parseSkillsCliFindOutput = (output: string): SkillsCliFindResult[] => {
  const lines = stripAnsi(output)
    .split(/\r?\n/)
    .map(line => line.replace(/\u0008/g, '').trim())
  const results: SkillsCliFindResult[] = []
  let currentResult: SkillsCliFindResult | undefined

  const pushCurrentResult = () => {
    if (currentResult == null) return
    results.push(currentResult)
    currentResult = undefined
  }

  for (const line of lines) {
    if (line === '' || line.startsWith('Install with ') || line.startsWith('No skills found')) {
      continue
    }

    if (line.startsWith('└ ')) {
      if (currentResult != null) {
        currentResult.url = line.slice(2).trim()
        pushCurrentResult()
      }
      continue
    }

    const match = line.match(/^(\S+@\S+)\s+(.+? installs.*?)$/)
    if (match == null) continue

    pushCurrentResult()
    const installRef = match[1].trim()
    const atIndex = installRef.lastIndexOf('@')
    if (atIndex <= 0 || atIndex >= installRef.length - 1) continue

    currentResult = {
      installRef,
      source: installRef.slice(0, atIndex),
      skill: installRef.slice(atIndex + 1),
      installsLabel: match[2].trim()
    }
  }

  pushCurrentResult()
  return results
}

export const listSkillsCliSource = async (params: {
  config?: SkillsCliConfig
  registry?: string
  source: string
}) => {
  const source = normalizeNonEmptyString(params.source)
  if (source == null) {
    throw new Error('skills CLI source is required.')
  }

  const cacheKey = toCacheKey({
    config: params.config,
    input: `list:${source}`,
    registry: params.registry
  })
  const cached = listCache.get(cacheKey)
  if (cached != null && cached.expiresAt > Date.now()) {
    return cached.results
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'vf-skills-cli-list-'))
  try {
    const { stdout, stderr } = await runSkillsCli({
      cwd: tempDir,
      config: params.config,
      registry: params.registry,
      args: ['add', source, '--list', '-y']
    })
    const results = parseSkillsCliListOutput(`${stdout}\n${stderr}`)

    if (results.length === 0) {
      throw new Error('skills CLI did not return any discoverable skills for this source.')
    }

    listCache.set(cacheKey, {
      expiresAt: Date.now() + LIST_CACHE_TTL_MS,
      results
    })

    return results
  } catch (error) {
    throw toSkillsCliError(error)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export const findSkillsCli = async (params: {
  config?: SkillsCliConfig
  query: string
  registry?: string
}) => {
  const query = normalizeNonEmptyString(params.query)
  if (query == null) return []

  const cacheKey = toCacheKey({
    config: params.config,
    input: `find:${query}`,
    registry: params.registry
  })
  const cached = findCache.get(cacheKey)
  if (cached != null && cached.expiresAt > Date.now()) {
    return cached.results
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'vf-skills-cli-find-'))
  try {
    const { stdout, stderr } = await runSkillsCli({
      cwd: tempDir,
      config: params.config,
      registry: params.registry,
      args: ['find', query]
    })
    const results = parseSkillsCliFindOutput(`${stdout}\n${stderr}`)
    findCache.set(cacheKey, {
      expiresAt: Date.now() + FIND_CACHE_TTL_MS,
      results
    })
    return results
  } catch (error) {
    throw toSkillsCliError(error)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

const readInstalledSkillMetadata = async (skillDir: string) => {
  try {
    const body = await readFile(join(skillDir, 'SKILL.md'), 'utf8')
    return {
      name: parseFrontmatterValue(body, 'name') ?? path.basename(skillDir),
      ...(parseFrontmatterValue(body, 'description') != null
        ? { description: parseFrontmatterValue(body, 'description') }
        : {})
    }
  } catch {
    return {
      name: path.basename(skillDir)
    }
  }
}

const selectInstalledSkillDir = async (params: {
  installedSkillsDir: string
  requestedSkill: string
}) => {
  const entries = await readdir(params.installedSkillsDir, { withFileTypes: true })
  const skillDirs = entries.filter(entry => entry.isDirectory())
  if (skillDirs.length === 0) {
    throw new Error(`skills CLI did not install any skills for "${params.requestedSkill}".`)
  }

  const installedSkills = await Promise.all(skillDirs.map(async (entry) => {
    const sourcePath = join(params.installedSkillsDir, entry.name)
    const metadata = await readInstalledSkillMetadata(sourcePath)
    return {
      dirName: entry.name,
      sourcePath,
      ...metadata
    }
  }))
  const requestedSlug = toSkillSlug(params.requestedSkill)
  const matched = installedSkills.find(skill => (
    skill.dirName === params.requestedSkill ||
    skill.name === params.requestedSkill ||
    toSkillSlug(skill.dirName) === requestedSlug ||
    toSkillSlug(skill.name) === requestedSlug
  ))

  if (matched != null) return matched
  if (installedSkills.length === 1) return installedSkills[0]

  throw new Error(
    `skills CLI installed multiple skills for "${params.requestedSkill}": ${
      installedSkills.map(skill => skill.name).join(', ')
    }`
  )
}

export const installSkillsCliSkillToTemp = async (params: {
  config?: SkillsCliConfig
  registry?: string
  skill: string
  source: string
}) => {
  const source = normalizeNonEmptyString(params.source)
  const skill = normalizeNonEmptyString(params.skill)
  if (source == null || skill == null) {
    throw new Error('skills CLI source and skill are required.')
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'vf-skills-cli-install-'))
  try {
    await runSkillsCli({
      cwd: tempDir,
      config: params.config,
      registry: params.registry,
      args: ['add', source, '--skill', skill, '--agent', 'universal', '--copy', '-y']
    })

    const installedSkill = await selectInstalledSkillDir({
      installedSkillsDir: join(tempDir, '.agents', 'skills'),
      requestedSkill: skill
    })

    return {
      installedSkill,
      tempDir
    }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true })
    throw toSkillsCliError(error)
  }
}

export const installSkillsCliRefToTemp = async (params: {
  config?: SkillsCliConfig
  installRef: string
  registry?: string
}) => {
  const installRef = normalizeNonEmptyString(params.installRef)
  if (installRef == null) {
    throw new Error('skills CLI install ref is required.')
  }

  const atIndex = installRef.lastIndexOf('@')
  const requestedSkill = atIndex > 0 && atIndex < installRef.length - 1
    ? installRef.slice(atIndex + 1)
    : installRef
  const tempDir = await mkdtemp(join(tmpdir(), 'vf-skills-cli-install-'))
  try {
    await runSkillsCli({
      cwd: tempDir,
      config: params.config,
      registry: params.registry,
      args: ['add', installRef, '--agent', 'universal', '--copy', '-y']
    })

    const installedSkill = await selectInstalledSkillDir({
      installedSkillsDir: join(tempDir, '.agents', 'skills'),
      requestedSkill
    })

    return {
      installedSkill,
      tempDir
    }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true })
    throw toSkillsCliError(error)
  }
}

export const publishSkillsCli = async (params: {
  access?: string
  config?: SkillsCliConfig
  cwd: string
  group?: boolean | string
  region?: string
  registry?: string
  skillSpec: string
  yes?: boolean
}): Promise<PublishSkillsCliResult> => {
  const skillSpec = normalizeNonEmptyString(params.skillSpec)
  if (skillSpec == null) {
    throw new Error('skills CLI publish spec is required.')
  }

  const args = ['publish', skillSpec]
  const access = normalizeNonEmptyString(params.access)
  const region = normalizeNonEmptyString(params.region)
  const group = typeof params.group === 'string'
    ? normalizeNonEmptyString(params.group)
    : params.group

  if (params.yes === true) {
    args.push('-y')
  }
  if (access != null) {
    args.push('--access', access)
  }
  if (region != null) {
    args.push('--region', region)
  }
  if (group === true) {
    args.push('--group')
  } else if (typeof group === 'string') {
    args.push('--group', group)
  }

  try {
    const { stdout, stderr } = await runSkillsCli({
      cwd: params.cwd,
      config: params.config,
      registry: params.registry,
      args
    })

    return {
      stdout,
      stderr,
      output: [stdout, stderr]
        .map(chunk => stripAnsi(chunk).trim())
        .filter(Boolean)
        .join('\n')
    }
  } catch (error) {
    const normalized = toSkillsCliError(error)
    if (/Unknown command:\s*publish/i.test(normalized.message)) {
      throw new Error(
        'The configured skills CLI does not support publish. Configure skillsCli.registry or skillsCli.path to use a publish-capable skills CLI.'
      )
    }
    throw normalized
  }
}

const execFileAsync = (
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
