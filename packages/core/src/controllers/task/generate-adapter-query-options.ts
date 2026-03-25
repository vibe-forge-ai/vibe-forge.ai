import process from 'node:process'
import { basename, dirname } from 'node:path'

import type { AdapterQueryOptions } from '#~/adapter/type.js'
import { DefinitionLoader } from '#~/utils/definition-loader.js'
import type { Definition, Filter, Skill } from '#~/utils/definition-loader.js'

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

  // 1. 获取数据
  // 1.1 获取默认数据
  const entities = type !== 'entity'
    ? await loader.loadDefaultEntities()
    : []
  const skills = filterSkills(
    await loader.loadDefaultSkills(),
    input?.skills
  )
  const rules = await loader.loadDefaultRules()
  const specs = await loader.loadDefaultSpecs()

  // 1.2 获取指定数据
  const targetSkills: Definition<Skill>[] = []
  let targetBody = ''
  let targetToolsFilter: Filter | undefined
  let targetMcpServersFilter: Filter | undefined
  let selectedSkillsPrompt: Definition<Skill>[] = []
  if (input?.skills?.include != null && input.skills.include.length > 0) {
    selectedSkillsPrompt = dedupeSkills(
      filterSkills(
        await loader.loadSkills(input.skills.include),
        { include: input.skills.include }
      )
    )
  }
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
          await loader.loadRules(attributes.rules)
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
      targetSkills.push(...await loader.loadSkills(attributes.skills))
    }

    targetBody = body
    targetToolsFilter = attributes.tools
    targetMcpServersFilter = attributes.mcpServers
  }

  // 2. 基于数据生成上下文
  // 2.1 加载关联上下文
  systemPromptParts.push(loader.generateRulesPrompt(rules))
  systemPromptParts.push(loader.generateSkillsPrompt(targetSkills))
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
