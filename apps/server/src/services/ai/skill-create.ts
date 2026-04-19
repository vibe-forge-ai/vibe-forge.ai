import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

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

const toSkillBody = (name: string, description: string, body: string) => {
  const frontmatter = description.trim() === ''
    ? ''
    : `---\ndescription: ${JSON.stringify(description.trim())}\n---\n\n`
  const content = body.trim() === '' ? `# ${name.trim()}\n` : body.trim()
  return `${frontmatter}${content}\n`
}

export const createProjectSkill = async (workspaceRoot: string, input: CreateProjectSkillInput) => {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const description = typeof input.description === 'string' ? input.description : ''
  const skillBody = typeof input.body === 'string' ? input.body : ''
  const slug = toSkillSlug(name)

  if (name === '' || slug == null) {
    throw badRequest('Missing skill name', undefined, 'missing_skill_name')
  }

  const content = toSkillBody(name, description, skillBody)

  try {
    const skillDir = join(workspaceRoot, '.ai', 'skills', slug)
    const skillPath = join(skillDir, 'SKILL.md')
    await mkdir(skillDir, { recursive: true })
    await writeFile(skillPath, content, { encoding: 'utf8', flag: 'wx' })

    return {
      id: join('.ai', 'skills', slug, 'SKILL.md'),
      name: slug,
      description: description.trim(),
      always: false,
      body: content
    }
  } catch (err) {
    if (err && typeof err === 'object' && (err as { code?: unknown }).code === 'EEXIST') {
      throw conflict('Skill already exists', { name: slug }, 'skill_exists')
    }
    throw internalServerError('Failed to create skill', { cause: err, code: 'ai_skill_create_failed' })
  }
}
