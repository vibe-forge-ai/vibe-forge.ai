import { describe, expect, it, vi } from 'vitest'

import type { AdapterCliPreparer } from '@vibe-forge/types'

import { normalizeCliArgs } from '#~/cli-argv.js'
import { resolveAdapterPrepareRequests } from '#~/commands/adapter.js'

const createPreparer = (
  adapter: string,
  targets: AdapterCliPreparer['targets']
): AdapterCliPreparer => ({
  adapter,
  targets,
  prepare: vi.fn()
})

const toRequestKeys = (requests: ReturnType<typeof resolveAdapterPrepareRequests>) => (
  requests.map(request => `${request.adapter}.${request.target.key}`)
)

describe('adapter prepare command selection', () => {
  const preparers = [
    createPreparer('codex', [{
      key: 'cli',
      title: 'Codex CLI',
      aliases: ['codex'],
      configPath: ['cli']
    }]),
    createPreparer('claude-code', [
      {
        key: 'cli',
        title: 'Claude Code CLI',
        aliases: ['claude'],
        configPath: ['cli']
      },
      {
        key: 'routerCli',
        title: 'Claude Code Router CLI',
        aliases: ['ccr', 'router'],
        configPath: ['routerCli']
      }
    ])
  ]

  it('selects only config entries opted into prepareOnInstall when no targets are passed', () => {
    const requests = resolveAdapterPrepareRequests({
      config: {
        adapters: {
          codex: {
            cli: {
              prepareOnInstall: true
            }
          },
          'claude-code': {
            cli: {
              prepareOnInstall: false
            },
            routerCli: {
              prepareOnInstall: true
            }
          }
        }
      },
      preparers,
      targets: []
    })

    expect(toRequestKeys(requests)).toEqual([
      'codex.cli',
      'claude-code.routerCli'
    ])
  })

  it('expands adapter names and target aliases for explicit prepare requests', () => {
    const requests = resolveAdapterPrepareRequests({
      config: {},
      preparers,
      targets: ['claude', 'ccr', 'codex.cli']
    })

    expect(toRequestKeys(requests)).toEqual([
      'claude-code.cli',
      'claude-code.routerCli',
      'codex.cli'
    ])
  })

  it('selects every available prepare target with --all', () => {
    const requests = resolveAdapterPrepareRequests({
      all: true,
      config: {},
      preparers,
      targets: []
    })

    expect(toRequestKeys(requests)).toEqual([
      'codex.cli',
      'claude-code.cli',
      'claude-code.routerCli'
    ])
  })

  it('rejects unknown explicit targets', () => {
    expect(() =>
      resolveAdapterPrepareRequests({
        config: {},
        preparers,
        targets: ['missing']
      })
    ).toThrow('Unknown adapter CLI prepare target: missing')
  })

  it('keeps adapter as a root command instead of routing it through run', () => {
    expect(normalizeCliArgs(['adapter', 'prepare'])).toEqual(['adapter', 'prepare'])
  })
})
