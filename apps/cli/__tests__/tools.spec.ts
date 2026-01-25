import { describe, expect, it } from 'vitest'

import wait from '#~/mcp-tools/general/wait'

import { createToolTester } from './mcp-test-utils.js'

describe('mcp tools integration', () => {
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
})
