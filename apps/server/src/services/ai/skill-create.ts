import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Definition, Skill } from '@vibe-forge/types'

import { badRequest, conflict, internalServerError } from '#~/utils/http.js'

interface CreateProjectSkillInput {
  body?: unknown
  description?: unknown
  name?: unknown
}

const toSkillSlug = (value: string) => {
  const slug = value.trim().toLowerCase().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '')
  return slug === '' ? undefined : slug
}

const toSkillBodyContent = (name: string, body: string) => (
  body.trim() === '' ? `# ${name.trim()}` : body.trim()
)

const toSkillFileContent = (description: string, bodyContent: string) => {
  const frontmatter = description.trim() === ''
    ? ''
    : `---\ndescription: ${JSON.stringify(description.trim())}\n---\n\n`
  return `${frontmatter}${bodyContent}\n`
}

export const createProjectSkill = async (workspaceRoot: string, input: CreateProjectSkillInput) => {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const description = typeof input.description === 'string' ? input.description : ''
  const skillBody = typeof input.body === 'string' ? input.body : ''
  const slug = toSkillSlug(name)

  if (name === '' || slug == null) {
    throw badRequest('Missing skill name', undefined, 'missing_skill_name')
  }

  const bodyContent = toSkillBodyContent(name, skillBody)
  const content = toSkillFileContent(description, bodyContent)

  try {
    const skillDir = join(workspaceRoot, '.ai', 'skills', slug)
    const skillPath = join(skillDir, 'SKILL.md')
    await mkdir(skillDir, { recursive: true })
    await writeFile(skillPath, content, { encoding: 'utf8', flag: 'wx' })

    const attributes: Skill = description.trim() === ''
      ? {}
      : { description: description.trim() }
    return {
      path: skillPath,
      body: bodyContent,
      attributes,
      resolvedSource: 'project'
    } satisfies Definition<Skill>
  } catch (err) {
    if (err && typeof err === 'object' && (err as { code?: unknown }).code === 'EEXIST') {
      throw conflict('Skill already exists', { name: slug }, 'skill_exists')
    }
    throw internalServerError('Failed to create skill', { cause: err, code: 'ai_skill_create_failed' })
  }
}
