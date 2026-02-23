import './TodoTool.scss'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { defineToolRender } from '../defineToolRender'
import { ToolCallBox } from '../../ToolCallBox'

interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

export const TodoTool = defineToolRender(({ item }) => {
  const { t } = useTranslation()
  const input = (item.input != null ? item.input : {}) as { todos?: TodoItem[] }
  const todos = input.todos ?? []

  return (
    <div className='tool-group todo-tool'>
      <ToolCallBox
        defaultExpanded={true}
        header={
          <div className='todo-header'>
            <span className='material-symbols-rounded status-icon'>task_alt</span>
            <span className='todo-title'>{t('chat.tools.todo')}</span>
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
