import { describe, expect, it } from 'vitest'

import { buildGantt, buildGitGraph, parseTime, sanitizeId } from '../src/components/chat/SessionTimelinePanel/mermaid'
import type { Task } from '../src/components/chat/SessionTimelinePanel/mermaid'

const labels = {
  mainStart: 'Main Start',
  mainEnd: 'Main End',
  startTasks: 'Start Tasks',
  allTasksDone: 'All Tasks Done',
  askUserQuestion: 'Ask User',
  edit: 'Edit',
  resumeTask: 'Resume Task',
  userPrompt: 'User Prompt',
  userAnswer: 'User Answer',
  receiveReply: 'Receive Reply',
  taskStart: 'Task Start',
  taskEnd: 'Task End',
  ganttTitle: 'Timeline',
  ganttMainSection: 'Main',
  ganttTasksSection: 'Tasks'
}

const ganttLabels = {
  ganttTitle: 'Timeline',
  ganttMainSection: 'Main',
  ganttTasksSection: 'Tasks',
  askUserQuestion: 'Ask User',
  userAnswer: 'User Answer',
  receiveReply: 'Receive Reply'
}

const sampleMain: Task = {
  startTime: '09:00:00',
  endTime: '09:10:00',
  events: [
    {
      type: 'tool__StartTasks',
      startTime: '09:01:00',
      endTime: '09:05:00',
      tasks: {
        'task A': {
          startTime: '09:01:10',
          endTime: '09:04:50',
          events: [
            {
              type: 'tool__AskUserQuestion',
              startTime: '09:02:00',
              endTime: '09:02:30'
            }
          ]
        }
      }
    }
  ]
}

const cherryPickMain: Task = {
  startTime: '09:00:00',
  endTime: '09:05:00',
  events: [
    {
      type: 'tool__ResumeTask',
      startTime: '09:01:00',
      endTime: '09:01:05'
    },
    {
      type: 'user__Prompt',
      startTime: '09:02:00',
      endTime: '09:02:05'
    }
  ]
}

describe('sessionTimelineMermaid', () => {
  it('buildMermaid 生成包含分支与合并', () => {
    const result = buildGitGraph(sampleMain, labels)
    expect(result).toContain('gitGraph')
    expect(result).toContain('branch task_A')
    expect(result).toContain('merge task_A')
    expect(result).toContain('commit id:"09:00:00"')
  })

  it('buildGantt 生成分段任务', () => {
    const result = buildGantt(sampleMain, ganttLabels)
    expect(result).toContain('gantt')
    expect(result).toContain('section Main')
    expect(result).toContain('section Tasks')
    expect(result).toContain('task A')
  })

  it('buildMermaid 生成 cherry-pick', () => {
    const result = buildGitGraph(cherryPickMain, labels)
    expect(result).toContain('User Prompt')
  })

  it('sanitizeId 与 parseTime 可处理基础输入', () => {
    expect(sanitizeId('task A#1')).toBe('task_A_1')
    expect(parseTime('01:02:03')).toBe(3723)
    expect(parseTime('05:00')).toBe(18000)
  })
})
