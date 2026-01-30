import process from 'node:process'

import type { AdapterQueryOptions } from '#~/adapter/type.js'
import { DefinitionLoader } from '#~/utils/definition-loader.js'
import type { Entity, Spec } from '#~/utils/definition-loader.js'

export async function resolveTaskConfig(
  type: 'spec' | 'entity' | undefined,
  name?: string,
  cwd: string = process.cwd()
): Promise<Partial<AdapterQueryOptions>> {
  const loader = new DefinitionLoader(cwd)
  const options: Partial<AdapterQueryOptions> = {}

  // 1. Load Rules (always load 'always: true' rules unless overridden, or just load all for now as context)
  const rules = await loader.loadRules()
  const activeRules = rules.filter(r => r.attributes.always !== false)

  const systemPromptParts: string[] = []

  if (activeRules.length > 0) {
    systemPromptParts.push('## Global Rules')
    activeRules.forEach(rule => {
      if (rule.body.trim()) {
        systemPromptParts.push(rule.body.trim())
      }
    })
  }

  // 2. Load Spec or Entity if specified
  if (type && name) {
    let def: { body: string; attributes: Spec | Entity } | undefined

    if (type === 'spec') {
      def = await loader.loadSpec(name)
    } else if (type === 'entity') {
      def = await loader.loadEntity(name)
    }

    if (def) {
      // Merge Options
      const { attributes, body } = def

      if (attributes.mcpServers) {
        options.mcpServers = {
          include: attributes.mcpServers.include || [],
          exclude: attributes.mcpServers.exclude || []
        }
      }

      if (attributes.tools) {
        options.tools = {
          include: attributes.tools.include || [],
          exclude: attributes.tools.exclude || []
        }
      }

      // Add Definition to System Prompt
      systemPromptParts.push(`## Active ${type === 'spec' ? 'Specification' : 'Entity'}: ${name}`)
      if (attributes.description) {
        systemPromptParts.push(`Description: ${attributes.description}`)
      }
      if (body.trim()) {
        systemPromptParts.push(body.trim())
      }
    } else {
      // Fallback or warning? For now, just warn in logs if we had a logger, but here we just proceed.
      systemPromptParts.push(`WARN: Requested ${type} "${name}" not found.`)
    }
  }

  if (systemPromptParts.length > 0) {
    options.systemPrompt = systemPromptParts.join('\n\n')
  }

  return options
}
