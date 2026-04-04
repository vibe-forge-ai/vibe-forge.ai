import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  generateDefaultCCRConfigJSON,
  resolveDefaultClaudeCodeRouterPort
} from '../src/ccr/config'

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
  }

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

  it('maps model service timeout to CCR API_TIMEOUT_MS and prefers the default service when values differ', () => {
    const raw = generateDefaultCCRConfigJSON({
      cwd: '/tmp/project',
      userConfig: {
        defaultModelService: 'fast',
        defaultModel: 'gpt-5.4-mini',
        modelServices: {
          fast: {
            apiBaseUrl: 'https://example.test/fast/chat/completions',
            apiKey: 'fast-key',
            models: ['gpt-5.4-mini'],
            timeoutMs: 120000
          },
          slow: {
            apiBaseUrl: 'https://example.test/slow/chat/completions',
            apiKey: 'slow-key',
            models: ['gpt-5.4'],
            timeoutMs: 600000
          }
        }
      }
    })

    const config = JSON.parse(raw) as {
      API_TIMEOUT_MS?: number
    }

    expect(config.API_TIMEOUT_MS).toBe(120000)
  })

  it('preserves explicit CCR router network options', () => {
    const raw = generateDefaultCCRConfigJSON({
      cwd: '/tmp/project',
      userConfig: baseUserConfig,
      adapterOptions: {
        ccrOptions: {
          PORT: '4123',
          APIKEY: 'router-key'
        }
      }
    })

    const config = JSON.parse(raw) as {
      PORT?: string
      APIKEY?: string
    }

    expect(config.PORT).toBe('4123')
    expect(config.APIKEY).toBe('router-key')
  })

  it('assigns a stable workspace-specific CCR port when none is configured', () => {
    const cwd = '/tmp/project-alpha'
    const raw = generateDefaultCCRConfigJSON({
      cwd,
      userConfig: baseUserConfig
    })

    const config = JSON.parse(raw) as {
      PORT?: string
    }

    expect(config.PORT).toBe(String(resolveDefaultClaudeCodeRouterPort(cwd)))
    expect(config.PORT).not.toBe('3456')
  })

  it('adds a maxtoken transformer for model service maxOutputTokens without clobbering existing transformers', () => {
    const raw = generateDefaultCCRConfigJSON({
      cwd: '/tmp/project',
      userConfig: {
        defaultModelService: 'gateway',
        defaultModel: 'gpt-5.4',
        modelServices: {
          gateway: {
            apiBaseUrl: 'https://example.test/chat/completions',
            apiKey: 'gateway-key',
            models: ['gpt-5.4'],
            maxOutputTokens: 8192,
            extra: {
              claudeCodeRouterTransformer: {
                use: ['openrouter']
              }
            }
          }
        }
      }
    })

    const config = JSON.parse(raw) as {
      Providers: Array<{ transformer?: { use?: unknown[] } }>
    }

    expect(config.Providers[0]?.transformer?.use).toEqual([
      'openrouter',
      ['maxtoken', { max_tokens: 8192 }]
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

    expect(config.transformers.some(item => item.path.endsWith('logger.ts'))).toBe(true)
    expect(config.transformers.some(item => item.path.endsWith('openai-polyfill.ts'))).toBe(true)
    expect(config.transformers.some(item => item.path.endsWith('gemini-open-router-polyfill.ts'))).toBe(true)
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

    expect(config.transformers.some(item => item.path.endsWith('logger.ts'))).toBe(false)
  })
})
