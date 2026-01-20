import type { ChatMessageContent } from '@vibe-forge/core'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ToolCallBox } from '../ToolCallBox'

interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

export function TodoTool({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const { t } = useTranslation()
  const input = (item.input != null ? item.input : {}) as { todos?: TodoItem[] }
  const todos = input.todos ?? []

  return (
    <div className='tool-group todo-tool'>
      <ToolCallBox
        defaultExpanded={true}
        header={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className='material-symbols-outlined' style={{ fontSize: 18 }}>task_alt</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{t('chat.tools.todo')}</span>
          </div>
        }
        content={
          <div className='tool-content' style={{ padding: '8px' }}>
            {todos.map((todo, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  marginBottom: idx === todos.length - 1 ? 0 : '6px',
                  opacity: todo.status === 'completed' ? 0.6 : 1
                }}
              >
                <span
                  className='material-symbols-outlined'
                  style={{
                    fontSize: 16,
                    color: todo.status === 'completed'
                      ? '#10b981'
                      : todo.status === 'in_progress'
                      ? '#3b82f6'
                      : '#9ca3af',
                    marginTop: '2px'
                  }}
                >
                  {todo.status === 'completed'
                    ? 'check_circle'
                    : todo.status === 'in_progress'
                    ? 'clock_loader_40'
                    : 'radio_button_unchecked'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontSize: 13,
                      textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
                      color: '#374151'
                    }}
                  >
                    {todo.content}
                  </span>
                  {(todo.activeForm != null && todo.activeForm !== '') && todo.status === 'in_progress' && (
                    <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
                      {todo.activeForm}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        }
      />
    </div>
  )
}
