import { describe, expect, it } from 'vitest'

import {
  buildClaudeToolPresentation,
  getClaudeToolBaseName,
  isClaudeToolName
} from '#~/components/chat/tools/adapter-claude/claude-tool-presentation'

describe('claude tool presentation', () => {
  it('normalizes claude tool names', () => {
    expect(getClaudeToolBaseName('adapter:claude-code:WebFetch')).toBe('WebFetch')
    expect(isClaudeToolName('adapter:claude-code:FutureTool')).toBe(true)
    expect(isClaudeToolName('Edit')).toBe(true)
    expect(isClaudeToolName('mcp__ChromeDevtools__click')).toBe(false)
  })

  it('builds edit tool sections with file-aware code blocks', () => {
    const presentation = buildClaudeToolPresentation('adapter:claude-code:Edit', {
      file_path: '/tmp/example.ts',
      old_string: 'const before = true\n',
      new_string: 'const after = false\n',
      replace_all: true
    })

    expect(presentation.primary).toBe('/tmp/example.ts')
    expect(presentation.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        labelKey: 'chat.tools.fields.replaceAll',
        format: 'inline',
        value: 'true'
      }),
      expect.objectContaining({
        labelKey: 'chat.tools.fields.oldString',
        format: 'code',
        lang: 'typescript'
      }),
      expect.objectContaining({
        labelKey: 'chat.tools.fields.newString',
        format: 'code',
        lang: 'typescript'
      })
    ]))
  })

  it('builds ask-user-question tool sections from question arrays', () => {
    const presentation = buildClaudeToolPresentation('adapter:claude-code:AskUserQuestion', {
      questions: [{
        header: 'Mode',
        question: 'Which mode should we use?',
        options: [
          { label: 'Safe', description: 'Ask before writing' },
          { label: 'Fast', description: 'Skip prompts' }
        ],
        multiSelect: false
      }]
    })

    expect(presentation.primary).toBe('Mode')
    const questionField = presentation.fields.find(field => field.labelKey === 'chat.tools.fields.questions')
    expect(questionField).toBeDefined()
    expect(questionField?.format).toBe('questions')
    expect(questionField?.value).toEqual([expect.objectContaining({
      header: 'Mode',
      question: 'Which mode should we use?',
      multiSelect: false
    })])
  })

  it('keeps structured task update fields readable', () => {
    const presentation = buildClaudeToolPresentation('adapter:claude-code:TaskUpdate', {
      taskId: 'task-123',
      status: 'completed',
      addBlocks: ['lint', 'typecheck'],
      metadata: { source: 'agent' }
    })

    expect(presentation.primary).toBe('task-123')
    expect(presentation.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        labelKey: 'chat.tools.fields.status',
        format: 'inline',
        value: 'completed'
      }),
      expect.objectContaining({
        labelKey: 'chat.tools.fields.addBlocks',
        format: 'list',
        value: ['lint', 'typecheck']
      }),
      expect.objectContaining({
        labelKey: 'chat.tools.fields.metadata',
        format: 'json',
        value: { source: 'agent' }
      })
    ]))
  })
})
