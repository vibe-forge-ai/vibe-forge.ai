import { describe, expect, it } from 'vitest'

import { adapterConfigContribution, copilotAdapterConfigSchema } from '#~/config-schema.js'

describe('copilot adapter config schema', () => {
  it('accepts stable Copilot CLI adapter capabilities', () => {
    expect(() =>
      copilotAdapterConfigSchema.parse({
        cli: {
          source: 'managed',
          version: '1.0.36'
        },
        effort: 'high',
        remote: true,
        agent: 'reviewer',
        agentDirs: ['/tmp/agents'],
        pluginDirs: ['/tmp/plugin-a', '/tmp/plugin-b'],
        additionalInstructions: 'Prefer minimal patches.',
        allowTools: ['shell(git:*)'],
        denyTools: ['shell(git push)'],
        allowUrls: ['https://docs.github.com/copilot/*'],
        denyUrls: ['https://example.invalid'],
        additionalDirs: ['/tmp/shared'],
        mode: 'autopilot',
        autopilot: true,
        maxAutopilotContinues: 3,
        noColor: true,
        noBanner: true,
        debug: true,
        experimental: true,
        enableReasoningSummaries: true,
        configContent: {
          askUser: false,
          nested: {
            keep: true
          }
        }
      })
    ).not.toThrow()
  })

  it('declares effort as adapter-common config and deep-merges native objects', () => {
    expect(adapterConfigContribution.configEntry?.extraCommonKeys).toEqual(['effort'])
    expect(adapterConfigContribution.configEntry?.deepMergeKeys).toEqual(['cli', 'configContent'])
  })
})
