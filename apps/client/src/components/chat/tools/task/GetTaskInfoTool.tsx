import './GetTaskInfoTool.scss'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { defineToolRender } from '../defineToolRender'
import { ToolCallBox } from '../../ToolCallBox'
import { TaskToolCard } from './components/TaskToolCard'

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

export const GetTaskInfoTool = defineToolRender(({ item, resultItem }) => {
  const { t } = useTranslation()

  const input = (item.input != null ? item.input : {}) as { taskId?: string }
  const inputTaskId = input.taskId

  const taskResult = useMemo(() => {
    if (!resultItem?.content) {
      return null
    }
    const text = resultItem.content[0].text.trim()
    const parsed = JSON.parse(text) as TaskResult[]
    return parsed[0] ?? null
  }, [resultItem?.content])

  const logs = taskResult?.logs ?? []
  const metaChips = taskResult ? (() => {
    const { exitCode, ...cardMeta } = taskResult
    return [
      cardMeta.adapter,
      cardMeta.type === 'default' ? undefined : cardMeta.type,
      cardMeta.name,
      cardMeta.status,
      exitCode != null ? t('chat.tools.taskExitCode', { code: exitCode }) : undefined,
      cardMeta.background === false ? t('chat.tools.startTasksForeground') : cardMeta.background === true ? t('chat.tools.startTasksBackground') : undefined
    ]
  })() : []
  const titleFallback = t('chat.tools.task')

  return (
    <div className='tool-group get-task-info-tool'>
      <ToolCallBox
        defaultExpanded={true}
        header={
          <div className='get-task-info-tool__header'>
            <span className='material-symbols-rounded get-task-info-tool__icon'>info</span>
            <span className='get-task-info-tool__title'>{t('chat.tools.getTaskInfo')}</span>
            <span className='get-task-info-tool__count'>{taskResult ? 1 : 0}</span>
          </div>
        }
        content={
          <div className='tool-content'>
            {taskResult ? (
              (() => {
                const { taskId, exitCode, ...cardProps } = taskResult
                return (
                  <TaskToolCard
                    {...cardProps}
                    logs={logs}
                    sessionId={taskId || inputTaskId}
                    titleFallback={titleFallback}
                    metaChips={metaChips}
                    showExecutionIcon={false}
                  />
                )
              })()
            ) : (
              <div className='get-task-info-tool__empty'>
                {t('chat.tools.startTasksEmpty')}
              </div>
            )}
          </div>
        }
      />
    </div>
  )
})
