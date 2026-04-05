import { describe, expect, it } from 'vitest'

import { resolveOpenCodeBinaryPath } from '#~/paths.js'
import {
  buildOpenCodeRunArgs,
  buildOpenCodeSessionTitle,
  extractOpenCodeSessionRecords,
  normalizeOpenCodePrompt,
  resolveLocalAttachmentPath,
  resolveOpenCodeAgent,
  selectOpenCodeSessionByTitle
} from '#~/runtime/common.js'

describe('resolveOpenCodeBinaryPath', () => {
  it('resolves to the adapter bundled binary by default', () => {
    expect(resolveOpenCodeBinaryPath({})).toMatch(/node_modules\/\.bin\/opencode$/)
  })

  it('returns the env-specified path when set', () => {
    expect(resolveOpenCodeBinaryPath({
      __VF_PROJECT_AI_ADAPTER_OPENCODE_CLI_PATH__: '/usr/local/bin/opencode'
    })).toBe('/usr/local/bin/opencode')
  })
})

describe('openCode prompt and session helpers', () => {
  it('normalizes prompt text and attachments', () => {
    const result = normalizeOpenCodePrompt([
      { type: 'text', text: 'Explain this diff' },
      { type: 'image', url: 'file:///tmp/screenshot.png' }
    ])

    expect(result.prompt).toBe('Explain this diff')
    expect(result.files).toEqual(['/tmp/screenshot.png'])
  })

  it('collects workspace file attachments into the file argument list', () => {
    const result = normalizeOpenCodePrompt([
      { type: 'text', text: 'Inspect these files' },
      { type: 'file', path: 'apps/client/src/main.tsx' },
      { type: 'file', path: '.ai/rules/CODING-STYLE.md' }
    ] as any)

    expect(result.prompt).toBe('Inspect these files')
    expect(result.files).toEqual([
      'apps/client/src/main.tsx',
      '.ai/rules/CODING-STYLE.md'
    ])
  })

  it('builds a deterministic session title', () => {
    expect(buildOpenCodeSessionTitle('session-1', 'VF')).toBe('VF:session-1')
  })

  it('filters managed CLI flags from passthrough options', () => {
    expect(buildOpenCodeRunArgs({
      prompt: 'hello',
      files: ['/tmp/a.txt'],
      model: 'openai/gpt-5',
      title: 'VF:session-1',
      extraOptions: ['--log-level', 'DEBUG', '--format', 'json', '--session', 'abc']
    })).toEqual([
      'run',
      '--format',
      'default',
      '--title',
      'VF:session-1',
      '--model',
      'openai/gpt-5',
      '--file',
      '/tmp/a.txt',
      '--log-level',
      'DEBUG',
      'hello'
    ])
  })

  it('extracts session records from common JSON shapes', () => {
    const records = extractOpenCodeSessionRecords({
      sessions: [
        { id: 'sess-old', title: 'VF:one', updatedAt: '2026-03-25T10:00:00.000Z' },
        { sessionId: 'sess-new', title: 'VF:one', updated_at: '2026-03-25T11:00:00.000Z' }
      ]
    })

    expect(records).toHaveLength(2)
    expect(selectOpenCodeSessionByTitle(records, 'VF:one')?.id).toBe('sess-new')
  })

  it('resolves only local attachment paths', () => {
    expect(resolveLocalAttachmentPath('file:///tmp/file.txt')).toBe('/tmp/file.txt')
    expect(resolveLocalAttachmentPath('/tmp/file.txt')).toBe('/tmp/file.txt')
    expect(resolveLocalAttachmentPath('https://example.com/file.txt')).toBeUndefined()
  })

  it('uses the plan agent by default in plan mode', () => {
    expect(resolveOpenCodeAgent({ permissionMode: 'plan' })).toBe('plan')
    expect(resolveOpenCodeAgent({
      permissionMode: 'plan',
      agent: 'build',
      planAgent: false
    })).toBe('build')
    expect(resolveOpenCodeAgent({
      permissionMode: 'plan',
      agent: 'build',
      planAgent: 'review'
    })).toBe('review')
  })
})
