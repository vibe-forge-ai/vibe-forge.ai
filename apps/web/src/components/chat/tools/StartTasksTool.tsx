import './StartTasksTool.scss'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChatMessageContent } from '@vibe-forge/core'

import { CodeBlock } from '../CodeBlock'
import { ToolCallBox } from '../ToolCallBox'

// 解析任务描述为标题和内容
function parseTaskDescription(description?: string): { title: string; content: string } {
  if (!description) {
    return { title: '', content: '' }
  }
  const lines = description.split('\n')
  const title = lines[0] || ''
  const content = lines.slice(1).join('\n').trim()
  return { title, content }
}

// 获取状态图标
function getStatusIcon(status?: string): string {
  switch (status) {
    case 'running':
      return 'play_circle'
    case 'completed':
      return 'check_circle'
    case 'failed':
      return 'error'
    default:
      return 'help_outline'
  }
}

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

  // 解析结果数据
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
          <div className='start-tasks-header'>
            <span className='material-symbols-rounded status-icon'>playlist_add</span>
            <span className='start-tasks-title'>{t('chat.tools.startTasks')}</span>
            <span className='start-tasks-count'>{tasks.length}</span>
          </div>
        }
        content={
          <div className='tool-content'>
            <div className='start-tasks-list'>
              {tasks.map((task, idx) => {
                const { description, type, name, adapter, background } = task
                const { status, taskId, logs = [] } = taskResults?.[idx] ?? {}
                const logText = (logs?.join('\n') ?? '').trim()

                const { title, content } = parseTaskDescription(description)

                return (
                  <div key={idx} className='start-task-row'>
                    <div className='start-task-left'>
                      <div className='start-task-status-icon'>
                        <span
                          className='material-symbols-rounded'
                          title={t(`common.status.${status || 'unknown'}`)}
                        >
                          {getStatusIcon(status)}
                        </span>
                      </div>
                      <div className='start-task-execution-icon'>
                        <span
                          className='material-symbols-rounded'
                          title={background === false
                            ? t('chat.tools.startTasksForeground')
                            : t('chat.tools.startTasksBackground')}
                        >
                          {background === false
                            ? 'desktop_windows'
                            : 'schedule'}
                        </span>
                      </div>
                    </div>
                    <div className='start-task-main'>
                      <div className='start-task-header'>
                        <div className='start-task-title'>
                          {title || t('chat.tools.startTasks')}
                        </div>
                        {taskId != null && taskId !== '' && (
                          <span className='session-id-placeholder'>{taskId}</span>
                        )}
                      </div>
                      {content && (
                        <div className='start-task-content'>
                          {content}
                        </div>
                      )}
                      <div className='start-task-meta'>
                        {[
                          adapter,
                          // 不展示默认类型
                          type === 'default' ? undefined : type,
                          name
                        ]
                          .filter(Boolean)
                          .map((item) => (
                            <span className='meta-chip' key={item}>{item}</span>
                          ))}
                      </div>
                      <CodeBlock
                        hideHeader
                        code={logText}
                        lang='md'
                      />
                    </div>
                  </div>
                )
              })}
              {tasks.length === 0 && (
                <div className='start-tasks-empty'>
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
