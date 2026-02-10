import './StartTasksTool.scss'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChatMessageContent } from '@vibe-forge/core'

import { ToolCallBox } from '../../ToolCallBox'
import { TaskToolCard } from './components/TaskToolCard'

interface StartTask {
  description?: string
  type?: 'default' | 'spec' | 'entity'
  name?: string
  adapter?: string
  background?: boolean
}

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

export function StartTasksTool({
  item,
  resultItem
}: {
  item: Extract<ChatMessageContent, { type: 'tool_use' }>
  resultItem?: Extract<ChatMessageContent, { type: 'tool_result' }>
}) {
  const { t } = useTranslation()

  const input = (item.input != null ? item.input : {}) as { tasks?: StartTask[] }
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
          <div className='start-tasks-tool__header'>
            <span className='material-symbols-rounded start-tasks-tool__icon'>playlist_add</span>
            <span className='start-tasks-tool__title'>{t('chat.tools.startTasks')}</span>
            <span className='start-tasks-tool__count'>{tasks.length}</span>
          </div>
        }
        content={
          <div className='tool-content'>
            <div className='start-tasks-tool__list'>
              {tasks.map((task, idx) => {
                const { description, type, name, adapter, background } = task
                const { status, taskId, logs = [] } = taskResults?.[idx] ?? {}
                const metaChips = [
                  adapter,
                  type === 'default' ? undefined : type,
                  name
                ]

                return (
                  <TaskToolCard
                    key={idx}
                    description={description}
                    status={status}
                    logs={logs}
                    adapter={adapter}
                    type={type}
                    name={name}
                    background={background}
                    sessionId={taskId}
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
}
