import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

import { resolveProjectAiPath } from '../ai-path'
import { parseSkillFrontmatterValue } from './shared'
import type { ProjectSkillSummary } from './types'

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
            const body = await readFile(join(skillsDir, entry.name, 'SKILL.md'), 'utf8')
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
