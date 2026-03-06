import './TodoTool.scss'
import React from 'react'
import { useTranslation } from 'react-i18next'
import type { ToolInputs } from '@vibe-forge/core'

import { ToolCallBox } from '../../ToolCallBox'
import { defineToolRender } from '../defineToolRender'

type TodoItem = ToolInputs['adapter:claude-code:TodoWrite']['todos'][number]

export const TodoTool = defineToolRender(({ item }) => {
  const { t } = useTranslation()
  const input = (item.input != null ? item.input : {}) as Partial<ToolInputs['adapter:claude-code:TodoWrite']>
  const todos = (input.todos ?? []) as TodoItem[]
  const totalCount = todos.length
  const completedCount = todos.filter(todo => todo.status === 'completed').length
  const inProgressCount = todos.filter(todo => todo.status === 'in_progress').length
  const pendingCount = totalCount - completedCount - inProgressCount

  return (
    <div className='tool-group todo-tool'>
      <ToolCallBox
        defaultExpanded={true}
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded tool-header-icon'>task_alt</span>
            <span className='tool-header-title'>{t('chat.tools.todo')}</span>
            {totalCount > 0 && (
              <span className='tool-header-chip'>{totalCount} total</span>
            )}
            {inProgressCount > 0 && (
              <span className='tool-header-chip'>{inProgressCount} doing</span>
            )}
            {pendingCount > 0 && (
              <span className='tool-header-chip'>{pendingCount} todo</span>
            )}
            {completedCount > 0 && (
              <span className='tool-header-chip'>{completedCount} done</span>
            )}
          </div>
        }
        content={
          <div className='tool-content'>
            {todos.map((todo, idx) => (
              <div
                key={idx}
                className={`todo-item ${todo.status}`}
              >
                <span className='material-symbols-rounded status-icon'>
                  {todo.status === 'completed'
                    ? 'check_circle'
                    : todo.status === 'in_progress'
                    ? 'clock_loader_40'
                    : 'radio_button_unchecked'}
                </span>
                <div className='todo-info'>
                  <span className='todo-text'>
                    {todo.content}
                  </span>
                  {(todo.activeForm != null && todo.activeForm !== '') && todo.status === 'in_progress' && (
                    <span className='active-form'>
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
})
