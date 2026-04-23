import { resolveConfigState } from '@vibe-forge/config'
import type { AdapterCtx, Config } from '@vibe-forge/types'
import { normalizePermissionToolName, splitManagedPermissionKeys } from '@vibe-forge/utils'

export type ManagedPermissionDecision = 'allow' | 'deny' | 'ask' | 'inherit'

export const resolveManagedPermissionDecision = (params: {
  permissions?: Config['permissions']
  subjectKeys: string[]
}): ManagedPermissionDecision => {
  const subjectKeySet = new Set(splitManagedPermissionKeys(params.subjectKeys).bare)
  const hasMatchingKey = (values: string[] | undefined) =>
    splitManagedPermissionKeys(values).bare.some(value => subjectKeySet.has(value))

  if (hasMatchingKey(params.permissions?.deny)) return 'deny'
  if (hasMatchingKey(params.permissions?.ask)) return 'ask'
  if (hasMatchingKey(params.permissions?.allow)) return 'allow'
  return 'inherit'
}

export const resolveManagedPermissionDecisionForCtx = (params: {
  ctx: AdapterCtx
  subjectKeys: string[]
}) => {
  const permissions = resolveConfigState({
    configState: params.ctx.configState,
    configs: params.ctx.configs
  }).mergedConfig.permissions

  return resolveManagedPermissionDecision({
    permissions,
    subjectKeys: params.subjectKeys
  })
}

export const buildMcpServerPermissionSubjectKeys = (serverName: string) => {
  const subject = normalizePermissionToolName(undefined, { mcpServer: serverName })
  return subject == null ? [serverName] : [subject.key, serverName]
}
