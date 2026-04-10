import './ListTasksTool.scss'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ToolCallBox } from '../core/ToolCallBox'
import { ToolSummaryHeader } from '../core/ToolSummaryHeader'
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
  const errorMeta = resultItem?.is_error === true
    ? (
      <span className='tool-status tool-status--error'>
        <span className='material-symbols-rounded'>error</span>
      </span>
    )
    : undefined

  return (
    <div className='tool-group tool-group--compact list-tasks-tool'>
      <ToolCallBox
        variant='inline'
        defaultExpanded={false}
        header={({ isExpanded, isCollapsible }) => (
          <ToolSummaryHeader
            icon={<span className='material-symbols-rounded'>list_alt</span>}
            title={t('chat.tools.listTasks')}
            target={t('chat.tools.taskCount', { count: taskResults.length })}
            expanded={isExpanded}
            collapsible={isCollapsible}
            meta={errorMeta}
            metaTitle={errorMeta == null ? undefined : t('chat.result')}
          />
        )}
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
