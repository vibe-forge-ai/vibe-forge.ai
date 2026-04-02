import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import askUser from '#~/tools/interaction/ask-user.js'
import wait from '#~/tools/general/wait.js'
import { createMcpTools } from '#~/tools/index.js'

import { createToolTester } from './mcp-test-utils.js'

describe('mcp tools integration', () => {
  beforeEach(() => {
    process.env.__VF_PROJECT_AI_SESSION_ID__ = 'sess-1'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    delete process.env.__VF_PROJECT_AI_SESSION_ID__
    vi.unstubAllGlobals()
  })

  it('registers task tools by default', () => {
    expect(createMcpTools()).toHaveProperty('task')
  })

  describe('wait tool', () => {
    it('should register wait tool', () => {
      const tester = createToolTester()
      wait(tester.mockRegister)

      expect(tester.getRegisteredTools()).toContain('wait')
      const info = tester.getToolInfo('wait')
      expect(info?.title).toBe('Wait Tool')
    })

    it('should wait for specified time', async () => {
      const tester = createToolTester()
      wait(tester.mockRegister)

      const start = Date.now()
      const ms = 100
      const result = await tester.callTool('wait', { ms }) as any
      const duration = Date.now() - start

      expect(duration).toBeGreaterThanOrEqual(ms - 10) // Allow some jitter
      expect(result.content[0].text).toBe(`Finished waiting for ${ms}ms`)
    })

    it('should fail validation with out-of-range input', async () => {
      const tester = createToolTester()
      wait(tester.mockRegister)

      // Max is 60000ms
      await expect(tester.callTool('wait', { ms: 70000 }))
        .rejects.toThrow()

      // Min is 0ms
      await expect(tester.callTool('wait', { ms: -1 }))
        .rejects.toThrow()
    })
  })

  describe('AskUserQuestion tool', () => {
    it('returns scalar answers as plain text content', async () => {
      const tester = createToolTester()
      askUser(tester.mockRegister)
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { result: '米饭' } })
      } as Response)

      const result = await tester.callTool('AskUserQuestion', {
        question: '今晚吃了什么？',
        options: [{ label: '米饭' }]
      }) as any

      expect(result.content).toEqual([{ type: 'text', text: '米饭' }])
    })

    it('returns multiselect answers as newline-separated text', async () => {
      const tester = createToolTester()
      askUser(tester.mockRegister)
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { result: ['米饭', '面条'] } })
      } as Response)

      const result = await tester.callTool('AskUserQuestion', {
        question: '今晚吃了什么？',
        options: [{ label: '米饭' }, { label: '面条' }],
        multiselect: true
      }) as any

      expect(result.content).toEqual([{ type: 'text', text: '米饭\n面条' }])
    })
  })
})
