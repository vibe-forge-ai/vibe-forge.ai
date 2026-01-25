import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'

import { createFilteredRegister, shouldEnableCategory } from '#~/mcp-tools/proxy'

describe('proxy logic', () => {
  describe('shouldEnableCategory', () => {
    it('should enable when no filters', () => {
      expect(shouldEnableCategory('cat1', {})).toBe(true)
    })

    it('should respect include', () => {
      expect(shouldEnableCategory('cat1', { include: ['cat1'] })).toBe(true)
      expect(shouldEnableCategory('cat2', { include: ['cat1'] })).toBe(false)
    })

    it('should respect exclude', () => {
      expect(shouldEnableCategory('cat1', { exclude: ['cat1'] })).toBe(false)
      expect(shouldEnableCategory('cat2', { exclude: ['cat1'] })).toBe(true)
    })

    it('should prioritize include then exclude', () => {
      expect(shouldEnableCategory('cat1', { include: ['cat1'], exclude: ['cat1'] })).toBe(false)
      expect(shouldEnableCategory('cat1', { include: ['cat1'], exclude: ['cat2'] })).toBe(true)
    })
  })

  describe('createFilteredRegister', () => {
    const mockTool = { disable: vi.fn() }
    const mockPrompt = { disable: vi.fn() }
    const mockResource = { disable: vi.fn() }

    const mockServer = {
      registerTool: vi.fn().mockReturnValue(mockTool),
      registerPrompt: vi.fn().mockReturnValue(mockPrompt),
      registerResource: vi.fn().mockReturnValue(mockResource)
    } as unknown as McpServer

    it('should disable tool if not included', () => {
      const proxy = createFilteredRegister(mockServer, {
        tools: { include: ['tool1'] }
      })

      proxy.registerTool('tool2', { description: 'test' }, async () => ({ content: [] }))
      expect(mockTool.disable).toHaveBeenCalled()
    })

    it('should NOT disable tool if included', () => {
      const proxy = createFilteredRegister(mockServer, {
        tools: { include: ['tool1'] }
      })

      vi.clearAllMocks()
      proxy.registerTool('tool1', { description: 'test' }, async () => ({ content: [] }))
      expect(mockTool.disable).not.toHaveBeenCalled()
    })

    it('should disable tool if excluded', () => {
      const proxy = createFilteredRegister(mockServer, {
        tools: { exclude: ['tool1'] }
      })

      vi.clearAllMocks()
      proxy.registerTool('tool1', { description: 'test' }, async () => ({ content: [] }))
      expect(mockTool.disable).toHaveBeenCalled()
    })
  })
})
