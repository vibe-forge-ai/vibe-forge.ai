import type { Config } from '@vibe-forge/core'
import type { AdapterQueryOptions } from '@vibe-forge/core/adapter'

import { mapMcpServersToOpenCode } from './mcp'
import { deepMerge } from './object-utils'
import { mergePermissionNodes, normalizePermissionNode, rewritePermissionMode } from './permission-node'
import { buildToolPermissionConfig, mapPermissionModeToOpenCode } from './permissions'
import { buildToolConfig } from './tools'

export const buildInlineConfigContent = (params: {
  baseConfigContent?: Record<string, unknown>
  adapterConfigContent?: Record<string, unknown>
  envConfigContent?: Record<string, unknown>
  permissionMode?: AdapterQueryOptions['permissionMode']
  tools?: AdapterQueryOptions['tools']
  mcpServers?: AdapterQueryOptions['mcpServers']
  availableMcpServers?: Config['mcpServers']
  systemPromptFile?: string
  providerConfig?: Record<string, unknown>
}) => {
  const mergedBaseConfig = deepMerge(
    deepMerge(params.baseConfigContent ?? {}, params.envConfigContent ?? {}),
    params.adapterConfigContent ?? {}
  )
  const inheritedPermission = normalizePermissionNode(mergedBaseConfig.permission)
  const hasToolFilter = (params.tools?.include?.length ?? 0) > 0 || (params.tools?.exclude?.length ?? 0) > 0
  const basePermission = params.permissionMode === 'dontAsk' || params.permissionMode === 'bypassPermissions'
    ? rewritePermissionMode(inheritedPermission, params.permissionMode)
    : mergePermissionNodes(inheritedPermission, mapPermissionModeToOpenCode(params.permissionMode))
  const permission = params.permissionMode == null && !hasToolFilter
    ? undefined
    : mergePermissionNodes(basePermission, buildToolPermissionConfig(params.tools, basePermission))
  const tools = buildToolConfig(params.tools)
  const mcp = mapMcpServersToOpenCode(params.availableMcpServers, params.mcpServers)
  const inheritedInstructions = Array.isArray(mergedBaseConfig.instructions)
    ? mergedBaseConfig.instructions.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    : []
  const instructions = params.systemPromptFile == null
    ? inheritedInstructions
    : [...inheritedInstructions, params.systemPromptFile]

  return deepMerge(mergedBaseConfig, {
    ...(instructions.length > 0 ? { instructions } : {}),
    ...(permission != null ? { permission } : {}),
    ...(tools ? { tools } : {}),
    ...(mcp ? { mcp } : {}),
    ...(params.providerConfig ? { provider: params.providerConfig } : {})
  })
}
