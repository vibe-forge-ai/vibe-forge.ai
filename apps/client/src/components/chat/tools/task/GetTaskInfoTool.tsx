import './GetTaskInfoTool.scss'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ToolInputs } from '@vibe-forge/core'

import { ToolCallBox } from '../core/ToolCallBox'
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

export const GetTaskInfoTool = defineToolRender(({ item, resultItem }) => {
  const { t } = useTranslation()

  const input = (item.input != null ? item.input : {}) as Partial<ToolInputs['GetTaskInfo']>
  const inputTaskId = input.taskId

  const taskResult = useMemo(() => {
    if (!resultItem?.content) {
      return null
    }
    const text = resultItem.content[0].text.trim()
    const parsed = JSON.parse(text) as TaskResult[]
    return parsed[0] ?? null
  }, [resultItem?.content])

  const metaChips = taskResult
    ? (() => {
      const { exitCode, ...cardMeta } = taskResult
      return [
        cardMeta.adapter,
        cardMeta.type === 'default' ? undefined : cardMeta.type,
        cardMeta.name,
        cardMeta.status,
        exitCode != null ? t('chat.tools.taskExitCode', { code: exitCode }) : undefined,
        cardMeta.background === false
          ? t('chat.tools.startTasksForeground')
          : cardMeta.background === true
          ? t('chat.tools.startTasksBackground')
          : undefined
      ]
    })()
    : []
  const titleFallback = t('chat.tools.task')

  return (
    <div className='tool-group get-task-info-tool'>
      <ToolCallBox
        defaultExpanded={true}
        header={
          <div className='tool-header-content'>
            <span className='material-symbols-rounded tool-header-icon'>info</span>
            <span className='tool-header-title'>{t('chat.tools.getTaskInfo')}</span>
            <span className='tool-header-chip'>{taskResult ? 1 : 0}</span>
          </div>
        }
        content={
          <div className='tool-content'>
            {taskResult
              ? (
                (() => {
                  const { taskId, exitCode, ...cardProps } = taskResult
                  return (
                    <TaskRow
                      description={cardProps.description}
                      status={cardProps.status}
                      background={cardProps.background}
                      sessionId={taskId || inputTaskId}
                      logs={cardProps.logs}
                      titleFallback={titleFallback}
                      metaChips={metaChips}
                      showExecutionIcon={false}
                    />
                  )
                })()
              )
              : (
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
