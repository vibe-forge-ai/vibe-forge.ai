/* eslint-disable no-labels */
import process from 'node:process'

import type { AdapterQueryOptions } from '#~/adapter/type.js'
import { DefinitionLoader } from '#~/utils/definition-loader.js'
import type { Definition, Filter, Skill } from '#~/utils/definition-loader.js'

export async function generateAdapterQueryOptions(
  type: 'spec' | 'entity' | undefined,
  name?: string,
  cwd: string = process.cwd()
): Promise<Partial<AdapterQueryOptions>> {
  const loader = new DefinitionLoader(cwd)
  const options: Partial<AdapterQueryOptions> = {}
  const systemPromptParts: string[] = []

  // 1. 获取数据
  // 1.1 获取默认数据
  const entities = type !== 'entity'
    ? await loader.loadDefaultEntities()
    : []
  const skills = await loader.loadDefaultSkills()
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
  return options
}
