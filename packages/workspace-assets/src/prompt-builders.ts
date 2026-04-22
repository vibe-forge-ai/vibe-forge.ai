import {
  isAlwaysRule,
  resolveDefinitionName,
  resolveDocumentDescription,
  resolveSpecIdentifier
} from '@vibe-forge/definition-core'
import type { Definition, Entity, Rule, Skill, Spec } from '@vibe-forge/types'
import { CANONICAL_VIBE_FORGE_MCP_SERVER_NAME, resolvePromptPath } from '@vibe-forge/utils'

import { buildManagedTaskToolGuidance } from './task-tool-guidance'

const toMarkdownBlockquote = (content: string) => (
  content
    .trim()
    .split('\n')
    .map(line => line === '' ? '>' : `> ${line}`)
    .join('\n')
)

const buildOptionalRuleGuidance = (cwd: string, rule: Definition<Rule>) => {
  const name = resolveDefinitionName(rule)
  const desc = resolveDocumentDescription(rule.body, rule.attributes.description, name)
  return [
    `Use when: ${desc}`,
    `Rule file path: ${resolvePromptPath(cwd, rule.path)}`,
    'Only read this rule file when the task matches the scenario above.'
  ].join('\n')
}

const buildSkillSummary = (
  cwd: string,
  skill: Definition<Skill>,
  guidance: string
) => {
  const name = resolveDefinitionName(skill, ['skill.md'])
  const desc = resolveDocumentDescription(skill.body, skill.attributes.description, name)
  return toMarkdownBlockquote(
    [
      `Skill description: ${desc}`,
      `Skill file path: ${resolvePromptPath(cwd, skill.path)}`,
      guidance
    ].join('\n')
  )
}

const renderSkillModule = (
  cwd: string,
  skill: Definition<Skill>,
  options: {
    guidance: string
    includeContent?: boolean
  }
) => {
  const parts = [
    `# ${resolveDefinitionName(skill, ['skill.md'])}`,
    '',
    buildSkillSummary(cwd, skill, options.guidance)
  ]

  if (options.includeContent) {
    parts.push('', '<skill-content>', skill.body.trim(), '</skill-content>')
  }

  return parts.join('\n')
}

export const generateRulesPrompt = (cwd: string, rules: Definition<Rule>[]) => {
  const rulesPrompt = rules
    .map((rule) => {
      const content = isAlwaysRule(rule.attributes) && rule.body.trim()
        ? rule.body.trim()
        : buildOptionalRuleGuidance(cwd, rule)
      return `# ${resolveDefinitionName(rule)}\n\n${toMarkdownBlockquote(content)}`
    })
    .filter(Boolean)
    .join('\n\n')

  return (
    '<system-prompt>\n' +
    'The project system rules are:\n' +
    `${rulesPrompt}\n` +
    '</system-prompt>\n'
  )
}

export const generateSkillsPrompt = (cwd: string, skills: Definition<Skill>[]) => {
  const modules = skills
    .map(skill =>
      renderSkillModule(cwd, skill, {
        guidance:
          'Resolve relative paths in the resource content relative to the directory containing this skill file.',
        includeContent: true
      })
    )
    .filter(Boolean)
    .join('\n\n')

  if (modules === '') return ''

  return `<system-prompt>\nThe following skill modules are loaded for the project:\n${modules}\n</system-prompt>\n`
}

export const generateSkillsRoutePrompt = (cwd: string, skills: Definition<Skill>[]) => {
  const modules = skills
    .filter(({ attributes: { always } }) => always !== false)
    .map(skill =>
      renderSkillModule(cwd, skill, {
        guidance:
          'Do not preload the body by default; read the corresponding skill file only when the task clearly requires it.'
      })
    )
    .filter(Boolean)
    .join('\n\n')

  if (modules === '') return ''

  return `<skills>\n${modules}\n</skills>\n`
}

export const generateSpecRoutePrompt = (
  specsDocuments: Definition<Spec>[],
  options?: { active?: boolean }
) => {
  const specsRouteStr = specsDocuments
    .filter(({ attributes }) => attributes.always !== false)
    .map((definition) => {
      const name = resolveDefinitionName(definition, ['index.md'])
      const desc = resolveDocumentDescription(definition.body, definition.attributes.description, name)
      const identifier = definition.resolvedName?.trim() ||
        resolveSpecIdentifier(definition.path, definition.attributes.name)
      const params = definition.attributes.params ?? []
      const paramsPrompt = params.length > 0
        ? params
          .map(({ name, description }) => `    - ${name}: ${description ?? 'None'}\n`)
          .join('')
        : '    - None\n'

      return (
        `- Workflow name: ${name}\n` +
        `  - Description: ${desc}\n` +
        `  - Identifier: ${identifier}\n` +
        '  - Parameters:\n' +
        `${paramsPrompt}`
      )
    })
    .join('\n')

  const activeIdentityPrompt = options?.active
    ? (
      'You are a professional project execution manager who can skillfully direct other entities to work toward your goal. Expectations:\n' +
      '\n' +
      '- Never complete code development work alone\n' +
      '- You must coordinate other developers to complete tasks\n' +
      '- You must keep them aligned with the goal and verify that their completion reports meet the requirements\n' +
      '\n'
    )
    : ''

  return (
    `<system-prompt>\n${activeIdentityPrompt}Choose the appropriate workflow based on the user's needs and the actual development goal, and use the workflow identifier to locate and load the corresponding definition.\n` +
    '- Pass the identifier based on the actual need. This is not a path; use the standard workflow loading capability to resolve it.\n' +
    '- Decide how to pass parameters based on their descriptions and actual usage scenarios.\n' +
    'The project includes the following workflows:\n' +
    `${specsRouteStr}\n` +
    '</system-prompt>\n'
  )
}

export const generateEntitiesRoutePrompt = (entities: Definition<Entity>[]) => {
  const taskToolGuidance = buildManagedTaskToolGuidance(CANONICAL_VIBE_FORGE_MCP_SERVER_NAME)
  return (
    '<system-prompt>\n' +
    'The project includes the following entities:\n' +
    `${
      entities
        .filter(({ attributes }) => attributes.always !== false)
        .map((definition) => {
          const name = resolveDefinitionName(definition, ['readme.md', 'index.json'])
          const desc = resolveDocumentDescription(definition.body, definition.attributes.description, name)
          return `  - ${name}: ${desc}\n`
        })
        .join('')
    }\n` +
    `When solving user problems, you may specify entities through \`${CANONICAL_VIBE_FORGE_MCP_SERVER_NAME}.StartTasks\` as needed and have them coordinate multiple entity types to complete the work; use \`${CANONICAL_VIBE_FORGE_MCP_SERVER_NAME}.GetTaskInfo\` and \`wait\` to track progress.\n` +
    `${taskToolGuidance}\n` +
    '</system-prompt>\n'
  )
}
