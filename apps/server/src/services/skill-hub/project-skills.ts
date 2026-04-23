import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { resolveProjectAiPath } from '@vibe-forge/utils'

export interface ProjectSkillSummary {
  dirName: string
  name: string
  description?: string
}

const stripWrappingQuotes = (value: string) => value.replace(/^["']|["']$/g, '')

const parseSkillFrontmatterValue = (body: string, key: 'description' | 'name') => {
  const lines = body.split('\n')
  if (lines[0]?.trim() !== '---') return undefined

  for (const line of lines.slice(1)) {
    if (line.trim() === '---') break
    const separatorIndex = line.indexOf(':')
    if (separatorIndex <= 0) continue
    if (line.slice(0, separatorIndex).trim() !== key) continue
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim())
    return value === '' ? undefined : value
  }

  return undefined
}

export const readProjectSkills = async (workspaceFolder: string): Promise<ProjectSkillSummary[]> => {
  const skillsDir = resolveProjectAiPath(workspaceFolder, process.env, 'skills')

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true })
    const skills = await Promise.all(
      entries
        .filter(entry => entry.isDirectory())
        .map(async (entry) => {
          const fallbackName = entry.name
          try {
            const body = await readFile(path.join(skillsDir, entry.name, 'SKILL.md'), 'utf8')
            return {
              dirName: entry.name,
              name: parseSkillFrontmatterValue(body, 'name') ?? fallbackName,
              ...(parseSkillFrontmatterValue(body, 'description') != null
                ? { description: parseSkillFrontmatterValue(body, 'description') }
                : {})
            }
          } catch {
            return {
              dirName: entry.name,
              name: fallbackName
            }
          }
        })
    )

    return skills
  } catch {
    return []
  }
}

export const readProjectSkillNames = async (workspaceFolder: string) => (
  new Set(
    (await readProjectSkills(workspaceFolder))
      .flatMap(skill => [skill.dirName, skill.name])
      .filter(Boolean)
  )
)
