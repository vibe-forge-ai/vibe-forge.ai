import './ChatTimelineView.scss'

import React from 'react'

import type { ChatMessage } from '@vibe-forge/core'

import { SessionTimelinePanel } from './SessionTimelinePanel'
import { SessionTimelineEventList } from './SessionTimelinePanel/EventList'
import type { Task } from './SessionTimelinePanel/types'

const mockTimelineTask: Task = {
  startTime: '09:40:00',
  endTime: '10:30:48',
  events: [
    {
      type: 'tool__StartTasks',
      startTime: '09:41:02',
      endTime: '10:10:25',
      tasks: {
        taskA: {
          startTime: '09:41:10',
          endTime: '09:55:02',
          description: 'Task A'
        },
        taskB: {
          startTime: '09:41:10',
          endTime: '09:50:40',
          description: 'Task B'
        },
        taskC: {
          startTime: '09:41:10',
          endTime: '10:10:20',
          description: 'Task C',
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
  messages
}: {
  messages: ChatMessage[]
}) {
  return (
    <div className='chat-timeline-view'>
      <section className='session-timeline-section session-timeline-section--fixed'>
        <SessionTimelinePanel
          task={mockTimelineTask}
          viewMode='gantt'
        />
      </section>
      <section className='session-timeline-section session-timeline-section--flex session-timeline-section--row'>
        <div className='session-timeline-column session-timeline-column--graph'>
          <SessionTimelinePanel
            task={mockTimelineTask}
            viewMode='git'
          />
        </div>
        <div className='session-timeline-column session-timeline-column--events'>
          <SessionTimelineEventList task={mockTimelineTask} />
        </div>
      </section>
    </div>
  )
}
