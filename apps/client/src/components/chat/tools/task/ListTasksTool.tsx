import './ListTasksTool.scss'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ToolCallBox } from '../../ToolCallBox'
import { defineToolRender } from '../defineToolRender'
import { TaskRow } from './components/TaskRow'

interface TaskResult {
  taskId: string
  status?: 'running' | 'completed' | 'failed'
  exitCode?: number | null
  description?: string
  type?: 'default' | 'spec' | 'entity'
  name?: string | null
  adapter?: string | null
  background?: boolean
  logs?: string[] | null
}

export const ListTasksTool = defineToolRender(({ resultItem }) => {
  const { t } = useTranslation()

  const taskResults = useMemo(() => {
    if (!resultItem?.content) {
      return []
    }
    const text = resultItem.content[0].text.trim()
    return JSON.parse(text) as TaskResult[]
  }, [resultItem?.content])

  return (
    <div className='tool-group list-tasks-tool'>
      <ToolCallBox
        defaultExpanded={true}
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded tool-header-icon'>list_alt</span>
            <span className='tool-header-title'>{t('chat.tools.listTasks')}</span>
            <span className='tool-header-chip'>{taskResults.length}</span>
          </div>
        }
        content={
          <div className='tool-content'>
            <div className='list-tasks-tool__list'>
              {taskResults.map((task) => {
                const { taskId, exitCode, ...cardProps } = task
                const metaChips = [
                  cardProps.adapter,
                  cardProps.type === 'default' ? undefined : cardProps.type,
                  cardProps.name,
                  cardProps.status,
                  exitCode != null ? t('chat.tools.taskExitCode', { code: exitCode }) : undefined,
                  cardProps.background === false
                    ? t('chat.tools.startTasksForeground')
                    : cardProps.background === true
                    ? t('chat.tools.startTasksBackground')
                    : undefined
                ]
                return (
                  <TaskRow
                    key={taskId}
                    description={cardProps.description}
                    status={cardProps.status}
                    background={cardProps.background}
                    sessionId={taskId}
                    logs={cardProps.logs}
                    titleFallback={t('chat.tools.task')}
                    metaChips={metaChips}
                    showExecutionIcon={false}
                  />
                )
              })}
              {taskResults.length === 0 && (
                <div className='list-tasks-tool__empty'>
                  {t('chat.tools.listTasksEmpty')}
                </div>
              )}
            </div>
          </div>
        }
      />
    </div>
  )
})
