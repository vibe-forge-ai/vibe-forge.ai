import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'

import type {
  Definition,
  Entity,
  LocalRuleReference,
  RemoteRuleReference,
  Rule,
  RuleReference,
  Skill,
  Spec
} from '@vibe-forge/types'
import { normalizePath, resolveDocumentName, resolvePromptPath, resolveSpecIdentifier } from '@vibe-forge/utils'
import { resolveWorkspaceAssetBundle } from '@vibe-forge/workspace-assets'
import { glob } from 'fast-glob'
import fm from 'front-matter'
/**
 * 以结构化的方式加载本地文档数据
 */
export const loadLocalDocuments = async <Attrs extends object>(
  paths: string[]
): Promise<Definition<Attrs>[]> => {
  const promises = paths.map(async (path) => {
    const content = await readFile(path, 'utf-8')
    const { body, attributes } = fm<Attrs>(content)
    return {
      path,
      body,
      attributes
    }
  })
  return Promise.all(promises)
}

const getFirstNonEmptyLine = (text: string) =>
  text
    .split('\n')
    .map(line => line.trim())
    .find(Boolean)

const resolveDocumentDescription = (
  body: string,
  explicitDescription?: string,
  fallbackName?: string
) => {
  const trimmedDescription = explicitDescription?.trim()
  return trimmedDescription || getFirstNonEmptyLine(body) || fallbackName || ''
}

const isAlwaysRule = (attributes: Pick<Rule, 'always' | 'alwaysApply'>) => (
  attributes.always ?? attributes.alwaysApply ?? false
)

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

const toNonEmptyStringArray = (values: unknown): string[] => {
  if (!Array.isArray(values)) return []
  return values
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean)
}

const isLocalRuleReference = (value: RuleReference): value is LocalRuleReference => {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as { path?: unknown }).path === 'string' &&
    ((value as { type?: unknown }).type == null || (value as { type?: unknown }).type === 'local')
  )
}

const isRemoteRuleReference = (value: RuleReference): value is RemoteRuleReference => {
  return (
    value != null &&
    typeof value === 'object' &&
    value.type === 'remote'
  )
}

const resolveRulePattern = (pattern: string, baseDir: string) => {
  const trimmed = pattern.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return normalizePath(resolve(baseDir, trimmed))
  }
  return trimmed
}

const createRemoteRuleDefinition = (
  rule: RemoteRuleReference,
  index: number
): Definition<Rule> => {
  const tags = toNonEmptyStringArray(rule.tags)
  const desc = rule.desc?.trim() || (
    tags.length > 0
      ? `远程知识库标签：${tags.join(', ')}`
      : '远程知识库规则引用'
  )
  const bodyParts = [
    desc,
    tags.length > 0 ? `知识库标签：${tags.join(', ')}` : undefined,
    '该规则来自远程知识库引用，不对应本地文件。'
  ].filter((value): value is string => Boolean(value))

  return {
    path: `remote-rule-${index + 1}.md`,
    body: bodyParts.join('\n'),
    attributes: {
      name: tags.length > 0 ? `remote:${tags.join(',')}` : `remote-rule-${index + 1}`,
      description: desc
    }
  }
}

const resolveEntityIdentifier = (path: string, explicitName?: string) => {
  return resolveDocumentName(path, explicitName, ['readme.md', 'index.json'])
}

const resolveDefinitionName = <T extends { name?: string }>(
  definition: Definition<T>,
  indexFileNames: string[] = []
) => definition.resolvedName?.trim() || resolveDocumentName(definition.path, definition.attributes.name, indexFileNames)

const parseScopedReference = (value: string) => {
  if (
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('/') ||
    value.endsWith('.md') ||
    value.endsWith('.json')
  ) {
    return undefined
  }
  const separatorIndex = value.indexOf('/')
  if (separatorIndex <= 0) return undefined
  return {
    scope: value.slice(0, separatorIndex),
    name: value.slice(separatorIndex + 1)
  }
}

const resolveUniqueDefinition = <TDefinition extends { name?: string }>(
  definitions: Definition<TDefinition>[],
  ref: string,
  resolveIdentifier: (definition: Definition<TDefinition>) => string
) => {
  const scoped = parseScopedReference(ref)
  if (scoped != null) {
    return definitions.find(definition => definition.resolvedName === ref)
  }

  const matches = definitions.filter(definition => resolveIdentifier(definition) === ref)
  if (matches.length === 0) return undefined
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous asset reference ${ref}. Candidates: ${
        matches.map(item => item.resolvedName ?? resolveIdentifier(item)).join(', ')
      }`
    )
  }
  return matches[0]
}

export class DefinitionLoader {
  private readonly cwd: string

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd
  }

  private async scan(
    patterns: string[],
    cwd: string = this.cwd
  ): Promise<string[]> {
    const paths = await glob(patterns, { cwd, absolute: true })
    return paths.sort((a, b) => {
      const aKey = relative(cwd, a).split('\\').join('/')
      const bKey = relative(cwd, b).split('\\').join('/')
      return aKey.localeCompare(bKey)
    })
  }

  async loadRules(
    rules: RuleReference[],
    options?: {
      baseDir?: string
    }
  ) {
    const baseDir = options?.baseDir ?? this.cwd
    const definitions: Definition<Rule>[] = []

    for (const [index, rule] of rules.entries()) {
      if (typeof rule === 'string') {
        const pattern = resolveRulePattern(rule, baseDir)
        if (!pattern) continue
        definitions.push(
          ...await loadLocalDocuments<Rule>(
            await this.scan([pattern])
          )
        )
        continue
      }

      if (isRemoteRuleReference(rule)) {
        definitions.push(createRemoteRuleDefinition(rule, index))
        continue
      }

      if (!isLocalRuleReference(rule)) continue

      const pattern = resolveRulePattern(rule.path, baseDir)
      if (!pattern) continue

      const docs = await loadLocalDocuments<Rule>(
        await this.scan([pattern])
      )

      definitions.push(
        ...docs.map((doc) => ({
          ...doc,
          attributes: {
            ...doc.attributes,
            description: rule.desc?.trim() || doc.attributes.description
          }
        }))
      )
    }

    return definitions
  }

  async loadDefaultRules(): Promise<Definition<Rule>[]> {
    const bundle = await resolveWorkspaceAssetBundle({ cwd: this.cwd })
    return bundle.rules.map(rule => ({
      ...rule.payload.definition,
      resolvedName: rule.displayName,
      resolvedInstancePath: rule.instancePath
    }))
  }

  generateRulesPrompt(rules: Definition<Rule>[]): string {
    const rulesPrompt = rules
      .map((rule) => {
        const { body, attributes } = rule
        const name = resolveDefinitionName(rule)
        const content = isAlwaysRule(attributes) && body.trim()
          ? body.trim()
          : buildOptionalRuleGuidance(this.cwd, rule)
        return `# ${name}\n\n${toMarkdownBlockquote(content)}`
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

  async loadSkills(skills?: string[]): Promise<Definition<Skill>[]> {
    const bundle = await resolveWorkspaceAssetBundle({ cwd: this.cwd })
    const allSkills = bundle.skills.map(skill => ({
      ...skill.payload.definition,
      resolvedName: skill.displayName,
      resolvedInstancePath: skill.instancePath
    }))
    if (skills == null) return allSkills

    return skills
      .map(skillRef =>
        resolveUniqueDefinition(
          allSkills,
          skillRef,
          skill => resolveDocumentName(skill.path, skill.attributes.name, ['skill.md'])
        )
      )
      .filter((skill): skill is Definition<Skill> => skill != null)
  }

  async loadDefaultSkills(): Promise<Definition<Skill>[]> {
    return this.loadSkills()
  }

  generateSkillsPrompt(skills: Definition<Skill>[]): string {
    const modules = skills
      .map((skill) => {
        const name = resolveDefinitionName(skill, ['skill.md'])
        return [
          `# ${name}`,
          '',
          buildSkillSummary(
            this.cwd,
            skill,
            '资源内容中的相对路径相对该技能文件所在目录解析。'
          ),
          '',
          '<skill-content>',
          skill.body.trim(),
          '</skill-content>'
        ].join('\n')
      })
      .filter(Boolean)
      .join('\n\n')

    if (modules === '') return ''

    return `<system-prompt>\n项目已加载如下技能模块：\n${modules}\n</system-prompt>\n`
  }

  generateSkillsRoutePrompt(skills: Definition<Skill>[]): string {
    const modules = skills
      .filter(({ attributes: { always } }) => always !== false)
      .map((definition) => {
        const name = resolveDefinitionName(definition, ['skill.md'])
        return [
          `# ${name}`,
          '',
          buildSkillSummary(
            this.cwd,
            definition,
            '默认无需预先加载正文；仅在任务明确需要该技能时，再读取对应技能文件。'
          )
        ].join('\n')
      })
      .filter(Boolean)
      .join('\n\n')

    if (modules === '') return ''

    return `<skills>\n${modules}\n</skills>\n`
  }

  async loadSpec(name: string): Promise<Definition<Spec> | undefined> {
    const bundle = await resolveWorkspaceAssetBundle({ cwd: this.cwd })
    const specs = bundle.specs.map(spec => ({
      ...spec.payload.definition,
      resolvedName: spec.displayName,
      resolvedInstancePath: spec.instancePath
    }))
    return resolveUniqueDefinition(specs, name, spec => resolveSpecIdentifier(spec.path, spec.attributes.name))
  }

  async loadDefaultSpecs(): Promise<Definition<Spec>[]> {
    const bundle = await resolveWorkspaceAssetBundle({ cwd: this.cwd })
    return bundle.specs.map(spec => ({
      ...spec.payload.definition,
      resolvedName: spec.displayName,
      resolvedInstancePath: spec.instancePath
    }))
  }

  generateSpecRoutePrompt(specsDocuments: Definition<Spec>[]): string {
    const specsRouteStr = specsDocuments
      .filter(({ attributes }) => attributes.always !== false)
      .map((definition) => {
        const { path, body, attributes } = definition
        const name = resolveDefinitionName(definition, ['index.md'])
        const desc = resolveDocumentDescription(body, attributes.description, name)
        const identifier = definition.resolvedName?.trim() || resolveSpecIdentifier(path, attributes.name)
        const params = attributes.params ?? []
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
    return (
      '<system-prompt>\n' +
      '你是一个专业的项目推进管理大师，能够熟练指导其他实体来为你的目标工作。对你的预期是：\n' +
      '\n' +
      '- 永远不要单独完成代码开发工作\n' +
      '- 必须要协调其他的开发人员来完成任务\n' +
      '- 必须让他们按照目标进行完成，不要偏离目标，检查他们任务完成后的汇报内容是否符合要求\n' +
      '\n' +
      '根据用户需要以及实际的开发目标来决定使用不同的工作流程，调用 `load-spec` mcp tool 完成工作流程的加载。\n' +
      '- 根据实际需求传入标识，这不是路径，只能使用工具进行加载\n' +
      '- 通过参数的描述以及实际应用场景决定怎么传入参数\n' +
      '项目存在如下工作流程：\n' +
      `${specsRouteStr}\n` +
      '</system-prompt>\n'
    )
  }

  async loadEntity(name: string): Promise<Definition<Entity> | undefined> {
    const bundle = await resolveWorkspaceAssetBundle({ cwd: this.cwd })
    const entities = bundle.entities.map(entity => ({
      ...entity.payload.definition,
      resolvedName: entity.displayName,
      resolvedInstancePath: entity.instancePath
    }))
    return resolveUniqueDefinition(
      entities,
      name,
      entity => resolveEntityIdentifier(entity.path, entity.attributes.name)
    )
  }

  private async loadEntityFromJson(jsonPath: string): Promise<Definition<Entity>> {
    const entityDir = dirname(jsonPath)
    const jsonVariables: Record<string, string> = {
      workspaceFolder: process.env.WORKSPACE_FOLDER || this.cwd
    }

    const content = await readFile(jsonPath, 'utf-8')
    const entityJSONContent = content.replace(/\$\{([^}]+)\}/g, (_, key) => jsonVariables[key] ?? `$\{${key}}`)

    const entityData = JSON.parse(entityJSONContent) as Entity

    let prompt = entityData.prompt
    if (!prompt) {
      const promptPath = entityData.promptPath || 'AGENTS.md'
      const resolvedPromptPath = resolve(entityDir, promptPath)
      if (existsSync(resolvedPromptPath)) {
        prompt = await readFile(resolvedPromptPath, 'utf-8')
      }
    }

    return {
      path: jsonPath,
      body: prompt || '',
      attributes: entityData
    }
  }

  async loadDefaultEntities(): Promise<Definition<Entity>[]> {
    const bundle = await resolveWorkspaceAssetBundle({ cwd: this.cwd })
    return bundle.entities.map(entity => ({
      ...entity.payload.definition,
      resolvedName: entity.displayName,
      resolvedInstancePath: entity.instancePath
    }))
  }

  generateEntitiesRoutePrompt(entities: Definition<Entity>[]): string {
    return (
      '<system-prompt>\n' +
      '项目存在如下实体：\n' +
      `${
        entities
          .filter(({ attributes }) => attributes.always !== false)
          .map((definition) => {
            const { attributes, body } = definition
            const name = resolveDefinitionName(definition, ['readme.md', 'index.json'])
            const desc = resolveDocumentDescription(body, attributes.description, name)
            return `  - ${name}：${desc}\n`
          })
          .join('')
      }\n` +
      '解决用户问题时，需根据用户需求可以通过 run-tasks 工具指定为实体后，自行调度多个不同类型的实体来完成工作。\n' +
      '</system-prompt>\n'
    )
  }
}
