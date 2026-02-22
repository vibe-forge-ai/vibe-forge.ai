export type TimelineEventType =
  | 'tool__StartTasks'
  | 'tool__AskUserQuestion'
  | 'tool__Edit'
  | 'tool__ResumeTask'
  | 'user__Prompt'

interface TimelineBaseEvent {
  startTime: string
  endTime: string
}

export type TimelineEvent =
  & TimelineBaseEvent
  & (
    | {
      type: 'tool__StartTasks'
      tasks?: Record<string, Task>
    }
    | {
      type: 'tool__AskUserQuestion'
    }
    | {
      type: 'tool__Edit'
    }
    | {
      type: 'tool__ResumeTask'
    }
    | {
      type: 'user__Prompt'
    }
  )

export interface Task {
  startTime: string
  endTime: string
  events?: TimelineEvent[]
}
