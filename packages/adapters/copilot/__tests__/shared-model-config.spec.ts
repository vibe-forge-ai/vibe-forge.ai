import { describe, expect, it } from 'vitest'

import { resolveCopilotModelConfig } from '#~/runtime/shared.js'

import { makeCtx } from './runtime-test-helpers'

describe('resolveCopilotModelConfig', () => {
  it('normalizes chat completions provider base URLs for routed services', () => {
    const { ctx } = makeCtx({
      configs: [{
        modelServices: {
          kimi: {
            apiBaseUrl: 'https://api.moonshot.ai/v1/chat/completions',
            apiKey: 'kimi-key'
          }
        }
      }, undefined]
    })

    expect(resolveCopilotModelConfig(ctx, 'kimi,kimi-k2.5')).toMatchObject({
      cliModel: 'kimi-k2.5',
      providerEnv: {
        COPILOT_PROVIDER_BASE_URL: 'https://api.moonshot.ai/v1',
        COPILOT_PROVIDER_API_KEY: 'kimi-key',
        COPILOT_PROVIDER_MODEL_ID: 'kimi-k2.5',
        COPILOT_PROVIDER_WIRE_MODEL: 'kimi-k2.5',
        COPILOT_PROVIDER_TYPE: 'openai'
      }
    })
  })

  it('normalizes responses provider base URLs when wireApi is responses', () => {
    const { ctx } = makeCtx({
      configs: [{
        modelServices: {
          openai: {
            apiBaseUrl: 'https://example.test/v1/responses',
            apiKey: 'test-key',
            extra: {
              copilot: {
                wireApi: 'responses'
              }
            }
          }
        }
      }, undefined]
    })

    expect(resolveCopilotModelConfig(ctx, 'openai,gpt-5')).toMatchObject({
      providerEnv: {
        COPILOT_PROVIDER_BASE_URL: 'https://example.test/v1',
        COPILOT_PROVIDER_WIRE_API: 'responses'
      }
    })
  })
})
