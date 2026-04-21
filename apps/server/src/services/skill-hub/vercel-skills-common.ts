import path from 'node:path'
import process from 'node:process'

export const VERCEL_SKILLS_REGISTRY_ID = 'skills'
export const SKILLS_API_BASE = process.env.SKILLS_API_URL || 'https://skills.sh'

export interface SkillsDownloadResponse {
  files: Array<{
    path: string
    contents: string
  }>
  hash?: string
}

export const fetchSkillsJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`skills.sh request failed: ${response.status}.`)
  }
  return await response.json() as T
}

export const assertSafeSkillFilePath = (value: string) => {
  if (value.includes('\0') || value.startsWith('/') || /^[a-z]:/i.test(value)) {
    throw new Error(`Downloaded skill contains unsafe path "${value}".`)
  }
  const normalized = path.posix.normalize(value)
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Downloaded skill contains unsafe path "${value}".`)
  }
  return normalized
}
