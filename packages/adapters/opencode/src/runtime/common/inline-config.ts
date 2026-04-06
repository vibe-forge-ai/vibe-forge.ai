import type { AdapterQueryOptions, Config } from '@vibe-forge/types'

import { mapMcpServersToOpenCode } from './mcp'
import { deepMerge } from './object-utils'
import { mergePermissionNodes, normalizePermissionNode, rewritePermissionMode } from './permission-node'
import {
  buildManagedPermissionConfig,
  buildToolPermissionConfig,
  mapPermissionModeToOpenCode
} from './permissions'
import { buildToolConfig } from './tools'

export const buildInlineConfigContent = (params: {
  baseConfigContent?: Record<string, unknown>
  adapterConfigContent?: Record<string, unknown>
  envConfigContent?: Record<string, unknown>
  permissionMode?: AdapterQueryOptions['permissionMode']
  tools?: AdapterQueryOptions['tools']
  mcpServers?: AdapterQueryOptions['mcpServers']
  availableMcpServers?: Config['mcpServers']
  managedPermissions?: Config['permissions']
  systemPromptFile?: string
  providerConfig?: Record<string, unknown>
}) => {
  const mergedBaseConfig = deepMerge(
    deepMerge(params.baseConfigContent ?? {}, params.envConfigContent ?? {}),
    params.adapterConfigContent ?? {}
  )
  const inheritedPermission = normalizePermissionNode(mergedBaseConfig.permission)
  const hasToolFilter = (params.tools?.include?.length ?? 0) > 0 || (params.tools?.exclude?.length ?? 0) > 0
  const managedPermissionConfig = buildManagedPermissionConfig(params.managedPermissions)
  const basePermission = params.permissionMode === 'dontAsk' || params.permissionMode === 'bypassPermissions'
    ? rewritePermissionMode(inheritedPermission, params.permissionMode)
    : mergePermissionNodes(inheritedPermission, mapPermissionModeToOpenCode(params.permissionMode))
  const managedPermission = mergePermissionNodes(
    basePermission,
    managedPermissionConfig
  )
  const permission = params.permissionMode == null && !hasToolFilter && managedPermissionConfig == null
    ? undefined
    : mergePermissionNodes(managedPermission, buildToolPermissionConfig(params.tools, managedPermission))
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
