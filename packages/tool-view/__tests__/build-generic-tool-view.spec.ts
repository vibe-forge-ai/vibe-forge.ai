import { describe, expect, it } from 'vitest'

import { buildGenericToolView, buildToolViewId } from '@vibe-forge/tool-view'

describe('buildToolViewId', () => {
  it('uses the source message id and tool id to build a stable cache key', () => {
    expect(buildToolViewId('msg-1', 'tool-1')).toBe('msg-1:tool-1')
  })
})

describe('buildGenericToolView', () => {
  it('builds a diff artifact for edit-style tool payloads', () => {
    const view = buildGenericToolView({
      sourceMessageId: 'msg-edit',
      toolUse: {
        type: 'tool_use',
        id: 'tool-edit',
        name: 'edit',
        input: {
          file_path: 'src/demo.ts',
          old_string: 'before()',
          new_string: 'after()'
        }
      },
      toolResult: {
        type: 'tool_result',
        tool_use_id: 'tool-edit',
        content: {
          status: 'applied'
        }
      }
    })

    expect(view.toolViewId).toBe('msg-edit:tool-edit')
    expect(view.summary.title).toBe('Edit')
    expect(view.summary.status).toBe('success')
    expect(view.call?.defaultExpanded).toBe(false)
    expect(view.result?.defaultExpanded).toBe(false)
    expect(view.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'diff',
        language: 'typescript',
        original: 'before()',
        modified: 'after()'
      })
    ]))
  })

  it('keeps shell-like tools readable before a result arrives', () => {
    const view = buildGenericToolView({
      sourceMessageId: 'msg-bash',
      toolUse: {
        type: 'tool_use',
        id: 'tool-bash',
        name: 'bash',
        input: {
          command: 'pnpm test',
          cwd: '/repo'
        }
      }
    })

    expect(view.summary.title).toBe('Bash')
    expect(view.summary.primary).toBe('pnpm test')
    expect(view.summary.status).toBe('pending')
    expect(view.textFallback).toContain('Bash')
    expect(view.call?.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'fields' })
    ]))
  })
})
