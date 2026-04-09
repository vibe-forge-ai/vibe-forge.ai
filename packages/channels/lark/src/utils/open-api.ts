import type { LarkChannelConfig } from '#~/types.js'

export const resolveLarkOpenApiBaseUrl = (domain?: LarkChannelConfig['domain']) => {
  if (domain === 'Lark') {
    return 'https://open.larksuite.com'
  }
  return 'https://open.feishu.cn'
}

export const buildLarkOpenApiUrl = (
  path: string,
  domain?: LarkChannelConfig['domain']
) => `${resolveLarkOpenApiBaseUrl(domain)}${path}`
