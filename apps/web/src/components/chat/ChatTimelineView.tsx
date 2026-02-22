import './ChatTimelineView.scss'

import { Button } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import type { ChatMessage } from '@vibe-forge/core'

import type { Task } from './SessionTimelinePanel/types'
import { SessionTimelinePanel } from './SessionTimelinePanel'

const mockTimelineTask: Task = {
  startTime: '09:40:00',
  endTime: '10:12:48',
  events: [
    {
      type: 'tool__StartTasks',
      startTime: '09:41:02',
      endTime: '10:10:20',
      tasks: {
        taskA: {
          startTime: '09:41:10',
          endTime: '09:55:02'
        },
        taskB: {
          startTime: '09:41:10',
          endTime: '09:50:40'
        },
        taskC: {
          startTime: '09:41:10',
          endTime: '10:10:20',
          events: [
            {
              type: 'tool__StartTasks',
              startTime: '09:48:00',
              endTime: '10:05:30',
              tasks: {
                taskC0: {
                  startTime: '09:49:10',
                  endTime: '10:05:25',
                  events: [
                    {
                      type: 'tool__AskUserQuestion',
                      startTime: '09:57:00',
                      endTime: '09:57:08'
                    },
                    {
                      type: 'user__Prompt',
                      startTime: '09:57:22',
                      endTime: '09:57:10'
                    }
                  ]
                }
              }
            },
            {
              type: 'tool__Edit',
              startTime: '09:57:10',
              endTime: '09:57:20'
            },
            {
              type: 'tool__ResumeTask',
              startTime: '09:57:20',
              endTime: '09:58:10'
            }
          ]
        }
      }
    }
  ]
}

export function ChatTimelineView({
  messages,
  isThinking
}: {
  messages: ChatMessage[]
  isThinking: boolean
}) {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = React.useState<'git' | 'gantt'>('git')

  return (
    <div className='chat-timeline-view'>
      <div className='session-timeline-toolbar'>
        <Button
          className='session-timeline-toggle'
          type='default'
          onClick={() => setViewMode(viewMode === 'git' ? 'gantt' : 'git')}
        >
          {viewMode === 'git' ? t('chat.timeline.viewGantt') : t('chat.timeline.viewGit')}
        </Button>
      </div>
      <SessionTimelinePanel
        messages={messages}
        isThinking={isThinking}
        task={mockTimelineTask}
        viewMode={viewMode}
      />
    </div>
  )
}
