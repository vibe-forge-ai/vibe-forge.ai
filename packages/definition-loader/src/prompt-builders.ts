import type { Definition, Entity, Rule, Skill, Spec } from '@vibe-forge/types'
import { resolvePromptPath, resolveSpecIdentifier } from '@vibe-forge/utils'

import {
  isAlwaysRule,
  resolveDefinitionName,
  resolveDocumentDescription
} from './definition-utils'

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
    `适用场景：${desc}`,
    `规则文件路径：${resolvePromptPath(cwd, rule.path)}`,
    '仅在任务满足上述场景时，再阅读该规则文件。'
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
      `技能介绍：${desc}`,
      `技能文件路径：${resolvePromptPath(cwd, skill.path)}`,
      guidance
    ].join('\n')
  )
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
    '项目系统规则如下：\n' +
    `${rulesPrompt}\n` +
    '</system-prompt>\n'
  )
}

export const generateSkillsPrompt = (cwd: string, skills: Definition<Skill>[]) => {
  const modules = skills
    .map((skill) => [
      `# ${resolveDefinitionName(skill, ['skill.md'])}`,
      '',
      buildSkillSummary(
        cwd,
        skill,
        '资源内容中的相对路径相对该技能文件所在目录解析。'
      ),
      '',
      '<skill-content>',
      skill.body.trim(),
      '</skill-content>'
    ].join('\n'))
    .filter(Boolean)
    .join('\n\n')

  if (modules === '') return ''

  return `<system-prompt>\n项目已加载如下技能模块：\n${modules}\n</system-prompt>\n`
}

export const generateSkillsRoutePrompt = (cwd: string, skills: Definition<Skill>[]) => {
  const modules = skills
    .filter(({ attributes: { always } }) => always !== false)
    .map((skill) => [
      `# ${resolveDefinitionName(skill, ['skill.md'])}`,
      '',
      buildSkillSummary(
        cwd,
        skill,
        '默认无需预先加载正文；仅在任务明确需要该技能时，再读取对应技能文件。'
      )
    ].join('\n'))
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
      const identifier = definition.resolvedName?.trim() || resolveSpecIdentifier(definition.path, definition.attributes.name)
      const params = definition.attributes.params ?? []
      const paramsPrompt = params.length > 0
        ? params
          .map(({ name, description }) => `    - ${name}：${description ?? '无'}\n`)
          .join('')
        : '    - 无\n'

      return (
        `- 流程名称：${name}\n` +
        `  - 介绍：${desc}\n` +
        `  - 标识：${identifier}\n` +
        '  - 参数：\n' +
        `${paramsPrompt}`
      )
    })
    .join('\n')

  const activeIdentityPrompt = options?.active
    ? (
        '你是一个专业的项目推进管理大师，能够熟练指导其他实体来为你的目标工作。对你的预期是：\n' +
        '\n' +
        '- 永远不要单独完成代码开发工作\n' +
        '- 必须要协调其他的开发人员来完成任务\n' +
        '- 必须让他们按照目标进行完成，不要偏离目标，检查他们任务完成后的汇报内容是否符合要求\n' +
        '\n'
      )
    : ''

  return (
    `<system-prompt>\n${
      activeIdentityPrompt
    }根据用户需要以及实际的开发目标来决定使用不同的工作流程，调用 \`load-spec\` mcp tool 完成工作流程的加载。\n` +
    '- 根据实际需求传入标识，这不是路径，只能使用工具进行加载\n' +
    '- 通过参数的描述以及实际应用场景决定怎么传入参数\n' +
    '项目存在如下工作流程：\n' +
    `${specsRouteStr}\n` +
    '</system-prompt>\n'
  )
}

export const generateEntitiesRoutePrompt = (entities: Definition<Entity>[]) => {
  return (
    '<system-prompt>\n' +
    '项目存在如下实体：\n' +
    `${
      entities
        .filter(({ attributes }) => attributes.always !== false)
        .map((definition) => {
          const name = resolveDefinitionName(definition, ['readme.md', 'index.json'])
          const desc = resolveDocumentDescription(definition.body, definition.attributes.description, name)
          return `  - ${name}：${desc}\n`
        })
        .join('')
    }\n` +
    '解决用户问题时，需根据用户需求可以通过 run-tasks 工具指定为实体后，自行调度多个不同类型的实体来完成工作。\n' +
    '</system-prompt>\n'
  )
}
