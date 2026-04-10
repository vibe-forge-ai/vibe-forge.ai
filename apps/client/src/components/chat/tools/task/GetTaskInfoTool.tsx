import './GetTaskInfoTool.scss'

import type { ToolInputs } from '@vibe-forge/core'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ToolCallBox } from '../core/ToolCallBox'
import { getToolTargetPresentation } from '../core/tool-display'
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
  const taskIdPresentation = getToolTargetPresentation(taskResult?.taskId ?? inputTaskId)
  const errorMeta = resultItem?.is_error === true
    ? (
      <span className='tool-status tool-status--error'>
        <span className='material-symbols-rounded'>error</span>
      </span>
    )
    : undefined

  return (
    <div className='tool-group tool-group--compact get-task-info-tool'>
      <ToolCallBox
        variant='inline'
        defaultExpanded={false}
        header={({ isExpanded, isCollapsible }) => (
          <ToolSummaryHeader
            icon={<span className='material-symbols-rounded'>info</span>}
            title={t('chat.tools.getTaskInfo')}
            target={taskIdPresentation.text}
            targetTitle={taskIdPresentation.title}
            targetMonospace={taskIdPresentation.monospace}
            expanded={isExpanded}
            collapsible={isCollapsible}
            meta={errorMeta}
            metaTitle={errorMeta == null ? undefined : t('chat.result')}
          />
        )}
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
