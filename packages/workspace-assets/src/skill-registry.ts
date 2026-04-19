/* eslint-disable max-lines -- registry install logic keeps URL resolution, locking, and cache writes together */
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import type { Config } from '@vibe-forge/types'
import { resolveProjectAiPath } from '@vibe-forge/utils'

import type { NormalizedSkillDependency } from './skill-dependencies'

interface RegistryOptions {
  enabled: boolean
  searchBaseUrl: string
  downloadBaseUrl: string
}

interface RegistrySearchSkill {
  id?: string
  name?: string
  skillId?: string
  source?: string
}

interface RegistryDownloadFile {
  path?: string
  contents?: string
}

interface RegistryDownloadResponse {
  files?: RegistryDownloadFile[]
}

const DEFAULT_SKILL_REGISTRY_URL = 'https://skills.sh'
const FETCH_TIMEOUT_MS = 10_000
const INSTALL_LOCK_TIMEOUT_MS = 30_000
const INSTALL_LOCK_RETRY_MS = 100

const asNonEmptyString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
)

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

const toSkillSlug = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
)

const toCacheSegment = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'registry'
)

const resolveConfiguredRegistry = (
  projectConfig: Config | undefined,
  userConfig: Config | undefined
) => userConfig?.skills?.registry ?? projectConfig?.skills?.registry

const resolveRegistryOptions = (params: {
  configs: [Config?, Config?]
  registry?: string
}): RegistryOptions => {
  const [projectConfig, userConfig] = params.configs
  const configuredRegistry = params.registry ?? resolveConfiguredRegistry(projectConfig, userConfig)
  const envSearchBaseUrl = asNonEmptyString(process.env.SKILLS_API_URL)
  const envDownloadBaseUrl = asNonEmptyString(process.env.SKILLS_DOWNLOAD_URL)

  if (typeof configuredRegistry === 'string' && configuredRegistry.trim() !== '') {
    const baseUrl = normalizeBaseUrl(configuredRegistry.trim())
    return {
      enabled: true,
      searchBaseUrl: baseUrl,
      downloadBaseUrl: baseUrl
    }
  }

  if (configuredRegistry != null && typeof configuredRegistry === 'object') {
    const baseUrl = normalizeBaseUrl(
      asNonEmptyString(configuredRegistry.url) ?? DEFAULT_SKILL_REGISTRY_URL
    )
    return {
      enabled: configuredRegistry.enabled !== false,
      searchBaseUrl: normalizeBaseUrl(asNonEmptyString(configuredRegistry.searchUrl) ?? baseUrl),
      downloadBaseUrl: normalizeBaseUrl(asNonEmptyString(configuredRegistry.downloadUrl) ?? baseUrl)
    }
  }

  const baseUrl = normalizeBaseUrl(envSearchBaseUrl ?? DEFAULT_SKILL_REGISTRY_URL)
  return {
    enabled: true,
    searchBaseUrl: baseUrl,
    downloadBaseUrl: normalizeBaseUrl(envDownloadBaseUrl ?? baseUrl)
  }
}

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  })
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  return await response.json() as T
}

const parseSourceAndSlugFromId = (id: string | undefined) => {
  if (id == null) return undefined
  const segments = id.split('/').filter(Boolean)
  if (segments.length < 3) return undefined
  return {
    source: `${segments[0]}/${segments[1]}`,
    slug: segments.slice(2).join('/')
  }
}

const pickSearchResult = (
  skills: RegistrySearchSkill[],
  name: string
) => {
  const slug = toSkillSlug(name)
  return skills.find(skill => (
    skill.skillId === slug ||
    skill.name === name ||
    toSkillSlug(skill.name ?? '') === slug ||
    parseSourceAndSlugFromId(skill.id)?.slug === slug
  )) ?? skills[0]
}

const resolveRegistrySkillTarget = async (
  dependency: NormalizedSkillDependency,
  registry: RegistryOptions
) => {
  if (dependency.source != null) {
    return {
      source: dependency.source,
      slug: toSkillSlug(dependency.name)
    }
  }

  const searchUrl = `${registry.searchBaseUrl}/api/search?q=${encodeURIComponent(dependency.name)}&limit=10`
  const searchResult = await fetchJson<{
    skills?: RegistrySearchSkill[]
  }>(searchUrl)
  const skills = Array.isArray(searchResult.skills) ? searchResult.skills : []
  const picked = pickSearchResult(skills, dependency.name)
  if (picked == null) {
    throw new Error(`Skill ${dependency.name} was not found in ${registry.searchBaseUrl}`)
  }

  const parsed = parseSourceAndSlugFromId(picked.id)
  const source = asNonEmptyString(picked.source) ?? parsed?.source
  const slug = asNonEmptyString(picked.skillId) ?? parsed?.slug ?? toSkillSlug(picked.name ?? dependency.name)
  if (source == null || slug === '') {
    throw new Error(`Registry search result for ${dependency.name} did not include a source and skill id`)
  }

  return {
    source,
    slug
  }
}

const toSafeRelativePath = (filePath: string) => {
  const normalized = filePath.replace(/\\/g, '/')
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`Unsafe skill dependency file path ${filePath}`)
  }
  return normalized
}

const assertInside = (root: string, target: string) => {
  const relativePath = relative(root, target)
  if (
    relativePath === '' ||
    (
      relativePath !== '..' &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath)
    )
  ) {
    return
  }
  throw new Error(`Skill dependency file resolves outside ${root}`)
}

const pathExists = async (path: string) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const withInstallLock = async <T>(lockDir: string, callback: () => Promise<T>) => {
  const start = Date.now()
  await mkdir(dirname(lockDir), { recursive: true })

  while (true) {
    try {
      await mkdir(lockDir)
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (Date.now() - start > INSTALL_LOCK_TIMEOUT_MS) {
        throw new Error(`Timed out waiting for skill dependency install lock ${lockDir}`)
      }
      await delay(INSTALL_LOCK_RETRY_MS)
    }
  }

  try {
    return await callback()
  } finally {
    await rm(lockDir, { recursive: true, force: true })
  }
}

const buildInstallDir = (params: {
  cwd: string
  registry: RegistryOptions
  source: string
  slug: string
}) => {
  let registryKey = params.registry.downloadBaseUrl
  try {
    const parsed = new URL(params.registry.downloadBaseUrl)
    registryKey = `${parsed.hostname}${parsed.pathname}`
  } catch {
  }

  return resolveProjectAiPath(
    params.cwd,
    process.env,
    'caches',
    'skill-dependencies',
    toCacheSegment(registryKey),
    ...params.source.split('/').map(toCacheSegment),
    toCacheSegment(params.slug)
  )
}

export const installRegistrySkillDependency = async (params: {
  cwd: string
  configs: [Config?, Config?]
  dependency: NormalizedSkillDependency
}) => {
  const registry = resolveRegistryOptions({
    configs: params.configs,
    registry: params.dependency.registry
  })
  if (!registry.enabled) {
    throw new Error(`Skill dependency registry is disabled; cannot install ${params.dependency.ref}`)
  }

  const target = await resolveRegistrySkillTarget(params.dependency, registry)
  const [owner, repo] = target.source.split('/')
  if (owner == null || repo == null || owner === '' || repo === '') {
    throw new Error(`Skill dependency source ${target.source} must use owner/repo format`)
  }

  const downloadUrl = `${registry.downloadBaseUrl}/api/download/${encodeURIComponent(owner)}/${
    encodeURIComponent(repo)
  }/${encodeURIComponent(target.slug)}`
  const installDir = buildInstallDir({
    cwd: params.cwd,
    registry,
    source: target.source,
    slug: target.slug
  })
  const skillPath = resolve(installDir, 'SKILL.md')

  return await withInstallLock(`${installDir}.lock`, async () => {
    if (await pathExists(skillPath)) {
      return {
        installDir,
        skillPath
      }
    }

    const response = await fetchJson<RegistryDownloadResponse>(downloadUrl)
    const files = Array.isArray(response.files) ? response.files : []
    if (files.length === 0) {
      throw new Error(`Skill dependency ${params.dependency.ref} did not include any files`)
    }

    const tempDir = `${installDir}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await rm(tempDir, { recursive: true, force: true })
    await mkdir(tempDir, { recursive: true })

    try {
      let hasSkillMd = false
      for (const file of files) {
        const filePath = asNonEmptyString(file.path)
        if (filePath == null || typeof file.contents !== 'string') continue
        const relativePath = toSafeRelativePath(filePath)
        if (relativePath.toLowerCase() === 'skill.md') hasSkillMd = true

        const targetPath = resolve(tempDir, relativePath)
        assertInside(tempDir, targetPath)
        await mkdir(dirname(targetPath), { recursive: true })
        await writeFile(targetPath, file.contents, 'utf8')
      }

      if (!hasSkillMd) {
        throw new Error(`Skill dependency ${params.dependency.ref} did not include SKILL.md`)
      }

      await rm(installDir, { recursive: true, force: true })
      await rename(tempDir, installDir)
    } catch (error) {
      await rm(tempDir, { recursive: true, force: true })
      throw error
    }

    return {
      installDir,
      skillPath
    }
  })
}
