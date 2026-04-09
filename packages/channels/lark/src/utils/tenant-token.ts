import type { LarkChannelConfig, TenantTokenCacheEntry, TenantTokenProvider } from '#~/types.js'

import { isTenantAccessTokenResponse } from './guards'
import { buildLarkOpenApiUrl } from './open-api'

const tenantTokenCache = new Map<string, TenantTokenCacheEntry>()

export const createTenantTokenProvider = (config: LarkChannelConfig): TenantTokenProvider => {
  return async () => {
    const cacheKey = `${config.domain ?? 'Feishu'}:${config.appId}`
    const cached = tenantTokenCache.get(cacheKey)
    const now = Date.now()
    if (cached && cached.expiresAt - now >= 30 * 60 * 1000) {
      return cached.token
    }
    const response = await globalThis.fetch(
      buildLarkOpenApiUrl('/open-apis/auth/v3/tenant_access_token/internal', config.domain),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          app_id: config.appId,
          app_secret: config.appSecret
        })
      }
    )
    if (!response.ok) return undefined
    const data = await response.json().catch(() => undefined)
    if (!isTenantAccessTokenResponse(data)) return undefined
    if (data.code !== 0) return undefined
    if (data.tenant_access_token == null || data.tenant_access_token === '') return undefined
    const expireMs = typeof data.expire === 'number' ? data.expire * 1000 : 0
    if (expireMs > 0) {
      tenantTokenCache.set(cacheKey, {
        token: data.tenant_access_token,
        expiresAt: now + expireMs
      })
    }
    return data.tenant_access_token
  }
}
