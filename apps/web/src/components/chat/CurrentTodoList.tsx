import './CurrentTodoList.scss'
import type { ChatMessage } from '@vibe-forge/core'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: string
}

export function CurrentTodoList({ messages }: { messages: ChatMessage[] }) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  // Find the latest TodoWrite tool use
  let latestTodos: TodoItem[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      const todoUse = msg.content.find(c =>
        c && c.type === 'tool_use' && (c.name === 'TodoWrite' || c.name === 'todo_write')
      )
      if (todoUse && todoUse.type === 'tool_use' && todoUse.input && typeof todoUse.input === 'object') {
        const input = todoUse.input as { todos?: TodoItem[] }
        if (Array.isArray(input.todos)) {
          latestTodos = input.todos
          break
        }
      }
    }
  }

  if (latestTodos.length === 0) return null

  const completedCount = latestTodos.filter(t => t.status === 'completed').length
  const totalCount = latestTodos.length

  if (totalCount === 0) {
    return (
      <div className='current-todo-container empty'>
        <div className='todo-progress-bar empty'>
          <div className='progress-info'>
            <span className='material-symbols-outlined'>assignment_late</span>
            <span className='text'>{t('chat.todo.noTasks')}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`current-todo-container ${isExpanded ? 'expanded' : ''}`}>
      <div className='todo-progress-bar' onClick={() => setIsExpanded(!isExpanded)}>
        <div className='progress-info'>
          <span className='material-symbols-outlined'>assignment</span>
          <span className='text'>{t('chat.todo.progress', { completed: completedCount, total: totalCount })}</span>
        </div>
        <div className='progress-track'>
          <div
            className='progress-fill'
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
        <button className='expand-btn'>
          <span className='material-symbols-outlined'>
            {isExpanded ? 'expand_more' : 'expand_less'}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div className='todo-items-overlay'>
          <div className='todo-items-scroll-container'>
            {latestTodos.map((todo, idx) => (
              <div
                key={todo.id || idx}
                className={`todo-item-vertical status-${todo.status}`}
              >
                <span className='material-symbols-outlined icon'>
                  {todo.status === 'completed'
                    ? 'check_circle'
                    : todo.status === 'in_progress'
                    ? 'clock_loader_40'
                    : 'radio_button_unchecked'}
                </span>
                <div className='todo-content-wrapper'>
                  <span className='text'>{todo.content}</span>
                  {todo.priority && <span className={`priority-tag ${todo.priority}`}>{todo.priority}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
