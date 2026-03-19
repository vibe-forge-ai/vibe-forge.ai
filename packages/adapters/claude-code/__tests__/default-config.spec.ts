import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateDefaultCCRConfigJSON } from '../src/ccr/default-config'

describe('generateDefaultCCRConfigJSON', () => {
  const baseUserConfig = {
    defaultModelService: 'gpt-responses',
    defaultModel: 'gpt-5.2-codex-2026-01-14',
    modelServices: {
      'gpt-responses': {
        apiBaseUrl: 'http://aidp.bytedance.net/api/modelhub/online/responses',
        apiKey: 'test-key',
        models: ['gpt-5.2-codex-2026-01-14']
      }
    }
  } as const

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('appends configured query params to CCR provider URLs', () => {
    const raw = generateDefaultCCRConfigJSON({
      cwd: '/tmp/project',
      userConfig: {
        defaultModelService: 'gpt-responses',
        defaultModel: 'gpt-5.2-codex-2026-01-14',
        modelServices: {
          'gpt-responses': {
            apiBaseUrl: 'http://aidp.bytedance.net/api/modelhub/online/responses',
            apiKey: 'test-key',
            models: ['gpt-5.2-codex-2026-01-14'],
            extra: {
              codex: {
                queryParams: {
                  ak: 'test-key'
                }
              }
            }
          }
        }
      }
    })

    const config = JSON.parse(raw) as {
      Providers: Array<{ name: string; api_base_url: string }>
      Router: { default: string }
    }

    expect(config.Providers).toMatchObject([
      {
        name: 'gpt-responses',
        api_base_url: 'http://aidp.bytedance.net/api/modelhub/online/responses?ak=test-key'
      }
    ])
    expect(config.Router.default).toBe('gpt-responses,gpt-5.2-codex-2026-01-14')
  })

  it('keeps provider URLs unchanged when no query params are configured', () => {
    const raw = generateDefaultCCRConfigJSON({
      cwd: '/tmp/project',
      userConfig: {
        defaultModelService: 'gpt',
        defaultModel: 'gpt-5.4-2026-03-05',
        modelServices: {
          gpt: {
            apiBaseUrl: 'https://search.bytedance.net/gpt/openapi/online/v2/crawl',
            apiKey: 'test-key',
            models: ['gpt-5.4-2026-03-05']
          }
        }
      }
    })

    const config = JSON.parse(raw) as {
      Providers: Array<{ name: string; api_base_url: string }>
    }

    expect(config.Providers).toMatchObject([
      {
        name: 'gpt',
        api_base_url: 'https://search.bytedance.net/gpt/openapi/online/v2/crawl'
      }
    ])
  })

  it('injects logger transformer by default', () => {
    const raw = generateDefaultCCRConfigJSON({
      cwd: '/tmp/project',
      userConfig: baseUserConfig
    })

    const config = JSON.parse(raw) as {
      transformers: Array<{ path: string }>
    }

    expect(config.transformers.some(item => item.path.endsWith('logger.js'))).toBe(true)
  })

  it('allows disabling logger transformer explicitly', () => {
    const raw = generateDefaultCCRConfigJSON({
      cwd: '/tmp/project',
      userConfig: baseUserConfig,
      adapterOptions: {
        ccrTransformers: {
          logger: false
        }
      }
    })

    const config = JSON.parse(raw) as {
      transformers: Array<{ path: string }>
    }

    expect(config.transformers.some(item => item.path.endsWith('logger.js'))).toBe(false)
  })
})
