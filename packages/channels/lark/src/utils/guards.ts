import type { LarkRichNode, TenantAccessTokenResponse } from '#~/types.js'

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value != null
}

export const isTenantAccessTokenResponse = (value: unknown): value is TenantAccessTokenResponse => {
  if (!isRecord(value)) return false
  return typeof value.code === 'number' &&
    (value.msg == null || typeof value.msg === 'string') &&
    (value.tenant_access_token == null || typeof value.tenant_access_token === 'string') &&
    (value.expire == null || typeof value.expire === 'number')
}

export const isRichNode = (value: unknown): value is LarkRichNode => {
  return isRecord(value) && 'tag' in value
}
