import process from 'node:process'
import { basename, dirname } from 'node:path'

import type { AdapterQueryOptions } from '#~/adapter/type.js'
import { DefinitionLoader } from '#~/utils/definition-loader.js'
import type { Definition, Entity, Filter, Skill, Spec } from '#~/utils/definition-loader.js'

const filterSkills = (
  skills: Definition<Skill>[],
  selection?: AdapterQueryOptions['skills']
) => {
  if (selection == null) return skills

  const include = selection.include != null && selection.include.length > 0
    ? new Set(selection.include)
    : undefined
  const exclude = new Set(selection.exclude ?? [])

  return skills.filter((skill) => {
    const name = basename(dirname(skill.path))
    return (include == null || include.has(name)) && !exclude.has(name)
  })
}

const dedupeSkills = (skills: Definition<Skill>[]) => {
  const seen = new Set<string>()
  return skills.filter((skill) => {
    if (seen.has(skill.path)) return false
    seen.add(skill.path)
    return true
  })
}

type SkillSelectionInput =
  | AdapterQueryOptions['skills']
  | Entity['skills']
  | Spec['skills']

const toNormalizedSkillSelection = (
  selection?: SkillSelectionInput
): AdapterQueryOptions['skills'] | undefined => {
  if (selection == null) return undefined

  if (Array.isArray(selection)) {
    return selection.length > 0
      ? {
          include: selection
        }
      : undefined
  }

  if ('type' in selection && Array.isArray(selection.list)) {
    const list = selection.list.filter((item): item is string => typeof item === 'string')
    return selection.type === 'include'
      ? {
          include: list
        }
      : {
          exclude: list
        }
  }

  return selection
}

const mergeSkillSelections = (
  ...selections: Array<SkillSelectionInput | undefined>
): AdapterQueryOptions['skills'] | undefined => {
  let include: Set<string> | undefined
  const exclude = new Set<string>()

  for (const selection of selections) {
    const normalized = toNormalizedSkillSelection(selection)
    if (normalized == null) continue

    if (normalized.include != null && normalized.include.length > 0) {
      const current = new Set(normalized.include)
      include = include == null
        ? current
        : new Set([...include].filter(item => current.has(item)))
    }

    for (const item of normalized.exclude ?? []) {
      exclude.add(item)
    }
  }

  if (include == null && exclude.size === 0) return undefined

  return {
    include: include == null ? undefined : [...include],
    exclude: exclude.size === 0 ? undefined : [...exclude]
  }
}

const getIncludedSkillNames = (selection?: SkillSelectionInput): string[] => {
  const normalized = toNormalizedSkillSelection(selection)
  return normalized?.include ?? []
}

export async function generateAdapterQueryOptions(
  type: 'spec' | 'entity' | undefined,
  name?: string,
  cwd: string = process.cwd(),
  input?: {
    skills?: AdapterQueryOptions['skills']
  }
) {
  const loader = new DefinitionLoader(cwd)
  const options: Partial<AdapterQueryOptions> = {}
  const systemPromptParts: string[] = []
  let effectiveSkillSelection = toNormalizedSkillSelection(input?.skills)

  // 1. 获取数据
  // 1.1 获取默认数据
  const entities = type !== 'entity'
    ? await loader.loadDefaultEntities()
    : []
  const defaultSkills = await loader.loadDefaultSkills()
  const rules = await loader.loadDefaultRules()
  const specs = await loader.loadDefaultSpecs()

  // 1.2 获取指定数据
  const targetSkills: Definition<Skill>[] = []
  let targetBody = ''
  let targetToolsFilter: Filter | undefined
  let targetMcpServersFilter: Filter | undefined
  if (type && name) {
    const data = {
      spec: await loader.loadSpec(name),
      entity: await loader.loadEntity(name)
    }[type]
    if (!data) {
      throw new Error(`Failed to load ${type} ${name}`)
    }
    const { attributes, body } = data
    if (
      attributes.rules
    ) {
      // always load spec or entity tagged rules
      rules.push(
        ...(
          await loader.loadRules(attributes.rules, {
            baseDir: dirname(data.path)
          })
        ).map((rule) => ({
          ...rule,
          attributes: {
            ...rule.attributes,
            // 实体或流程中的规则为默认加载
            always: true
          }
        }))
      )
    }
    if (
      attributes.skills
    ) {
      effectiveSkillSelection = mergeSkillSelections(
        input?.skills,
        attributes.skills
      )
      targetSkills.push(
        ...filterSkills(
          await loader.loadSkills(getIncludedSkillNames(attributes.skills)),
          effectiveSkillSelection
        )
      )
    }

    targetBody = body
    targetToolsFilter = attributes.tools
    targetMcpServersFilter = attributes.mcpServers
  }
  const skills = filterSkills(defaultSkills, effectiveSkillSelection)
  let selectedSkillsPrompt: Definition<Skill>[] = []
  if (input?.skills?.include != null && input.skills.include.length > 0) {
    selectedSkillsPrompt = dedupeSkills(
      filterSkills(
        await loader.loadSkills(input.skills.include),
        effectiveSkillSelection
      )
    )
  }

  // 2. 基于数据生成上下文
  // 2.1 加载关联上下文
  systemPromptParts.push(loader.generateRulesPrompt(rules))
  systemPromptParts.push(loader.generateSkillsPrompt(dedupeSkills(targetSkills)))
  systemPromptParts.push(loader.generateSkillsPrompt(
    selectedSkillsPrompt.filter(skill => !targetSkills.some(target => target.path === skill.path))
  ))
  // 2.2 加载上下文路由
  systemPromptParts.push(loader.generateEntitiesRoutePrompt(entities))
  systemPromptParts.push(loader.generateSkillsRoutePrompt(skills))
  systemPromptParts.push(loader.generateSpecRoutePrompt(specs))
  // 2.3 加载目标上下文与配置
  systemPromptParts.push(targetBody)
  targetToolsFilter && (
    options.tools = targetToolsFilter
  )
  targetMcpServersFilter && (
    options.mcpServers = targetMcpServersFilter
  )

  options.systemPrompt = systemPromptParts.join('\n\n')
  return [
    {
      rules,
      targetSkills,
      entities,
      skills,
      specs,
      targetBody
    },
    options
  ] as const
}
