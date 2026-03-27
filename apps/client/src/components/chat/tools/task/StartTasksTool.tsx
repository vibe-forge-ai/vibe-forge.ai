import './StartTasksTool.scss'

import type { ToolInputs } from '@vibe-forge/core'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ToolCallBox } from '../core/ToolCallBox'
import { defineToolRender } from '../defineToolRender'
import { TaskRow } from './components/TaskRow'

type StartTask = ToolInputs['StartTasks']['tasks'][number]

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

export const StartTasksTool = defineToolRender(({ item, resultItem }) => {
  const { t } = useTranslation()

  const input = (item.input != null ? item.input : {}) as Partial<ToolInputs['StartTasks']>
  const tasks = Array.isArray(input.tasks) ? input.tasks : []

  const parsedResult = useMemo(() => {
    if (!resultItem?.content) {
      return { taskResults: null }
    }
    const text = resultItem.content[0].text.trim()
    return {
      taskResults: JSON.parse(text) as TaskResult[]
    }
  }, [resultItem?.content])

  const { taskResults } = parsedResult

  return (
    <div className='tool-group start-tasks-tool'>
      <ToolCallBox
        defaultExpanded={true}
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded tool-header-icon'>playlist_add</span>
            <span className='tool-header-title'>{t('chat.tools.startTasks')}</span>
            <span className='tool-header-chip'>{tasks.length}</span>
          </div>
        }
        content={
          <div className='tool-content'>
            <div className='start-tasks-tool__list'>
              {tasks.map((task: StartTask, idx: number) => {
                const { description, type, name, adapter, background } = task
                const { status, taskId, logs = [] } = taskResults?.[idx] ?? {}
                const metaChips = [
                  adapter,
                  type === 'default' ? undefined : type,
                  name
                ]

                return (
                  <TaskRow
                    key={idx}
                    description={description}
                    status={status}
                    background={background}
                    sessionId={taskId}
                    logs={logs}
                    titleFallback={t('chat.tools.startTasks')}
                    metaChips={metaChips}
                    showExecutionIcon={true}
                    foregroundLabel={t('chat.tools.startTasksForeground')}
                    backgroundLabel={t('chat.tools.startTasksBackground')}
                  />
                )
              })}
              {tasks.length === 0 && (
                <div className='start-tasks-tool__empty'>
                  {t('chat.tools.startTasksEmpty')}
                </div>
              )}
            </div>
          </div>
        }
      />
    </div>
  )
})
