import { describe, expect, it } from 'vitest'

import { normalizeCliArgs } from '#~/cli-argv.js'

describe('cli argv normalization', () => {
  it('routes bare invocations to the run subcommand', () => {
    expect(normalizeCliArgs([])).toEqual(['run'])
    expect(normalizeCliArgs(['explain', 'this'])).toEqual(['run', 'explain', 'this'])
    expect(normalizeCliArgs(['-A', 'codex', 'explain', 'this'])).toEqual(['run', '-A', 'codex', 'explain', 'this'])
    expect(normalizeCliArgs(['--resume', 'session-1'])).toEqual(['run', '--resume', 'session-1'])
  })

  it('preserves explicit subcommands and help/version flags', () => {
    expect(normalizeCliArgs(['run', 'hello'])).toEqual(['run', 'hello'])
    expect(normalizeCliArgs(['list'])).toEqual(['list'])
    expect(normalizeCliArgs(['benchmark', 'list'])).toEqual(['benchmark', 'list'])
    expect(normalizeCliArgs(['plugin', '--adapter', 'claude', 'add', 'demo@team-tools'])).toEqual([
      'plugin',
      '--adapter',
      'claude',
      'add',
      'demo@team-tools'
    ])
    expect(normalizeCliArgs(['--help'])).toEqual(['--help'])
    expect(normalizeCliArgs(['-V'])).toEqual(['-V'])
  })
})
