import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readFile } from 'node:fs/promises'

import { loadChannelAgentRules } from '#~/channels/middleware/dispatch/prompt/agent-rules.js'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

const readFileMock = vi.mocked(readFile)

beforeEach(() => {
  vi.clearAllMocks()
  // Ensure a predictable root
  process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = '/project'
})

afterEach(() => {
  delete process.env.__VF_PROJECT_WORKSPACE_FOLDER__
})

describe('loadChannelAgentRules', () => {
  it('returns content from the .ai/rules file when it exists', async () => {
    readFileMock.mockImplementation(async (path) => {
      if (String(path).includes('.ai/rules/AGENTS.channel.lark.md')) return 'ai rules'
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    const result = await loadChannelAgentRules('lark')
    expect(result).toBe('ai rules')
  })

  it('falls back to the project root file when .ai/rules is missing', async () => {
    readFileMock.mockImplementation(async (path) => {
      if (String(path).endsWith('AGENTS.channel.lark.md') && !String(path).includes('.ai/rules/')) return '  root rules  '
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })

    const result = await loadChannelAgentRules('lark')
    expect(result).toBe('root rules')
  })

  it('returns undefined when neither file exists', async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    const result = await loadChannelAgentRules('lark')
    expect(result).toBeUndefined()
  })

  it('skips a file whose content is blank and tries the next', async () => {
    readFileMock.mockImplementation(async (path) => {
      if (String(path).includes('.ai/rules/')) return '   '
      return 'fallback root rules'
    })

    const result = await loadChannelAgentRules('lark')
    expect(result).toBe('fallback root rules')
  })

  it('uses the channelType in the filename', async () => {
    readFileMock.mockResolvedValue('wecom specific rules')

    await loadChannelAgentRules('wecom')

    expect(readFileMock).toHaveBeenCalledWith(
      expect.stringContaining('AGENTS.channel.wecom.md'),
      'utf8'
    )
  })

  it('uses cwd() as root when env var is unset', async () => {
    delete process.env.__VF_PROJECT_WORKSPACE_FOLDER__
    readFileMock.mockResolvedValue('cwd rules')

    const result = await loadChannelAgentRules('lark')
    expect(result).toBe('cwd rules')
  })
})
