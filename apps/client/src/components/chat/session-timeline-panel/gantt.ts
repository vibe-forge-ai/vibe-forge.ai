import type { Task, TimelineDiagram, TimelineEvent, TimelineInteraction } from './types'
import { normalizeTime, parseTime } from './utils'

interface GanttItem {
  id: string
  label: string
  start: string
  end?: string
  sectionId: string
  sectionLabel: string
  type: 'task'
  interaction?: TimelineInteraction
}

interface GanttLabels {
  ganttTitle: string
  ganttMainSection: string
  ganttTasksSection: string
  resumeTask: string
  userPrompt: string
}

function createGanttItemIdFactory() {
  let seq = 0
  return (prefix: string) => `${prefix}_${seq++}`
}

function collectGanttItems(task: Task, labels: GanttLabels) {
  const nextId = createGanttItemIdFactory()
  const nextSectionId = createGanttItemIdFactory()
  const interactions: TimelineInteraction[] = []
  const items: GanttItem[] = []
  const blankSectionLabel = '\u200B'
  let blankSectionSequence = 0
  const nextBlankSectionLabel = () => {
    blankSectionSequence += 1
    return blankSectionLabel.repeat(blankSectionSequence)
  }

  const addInteraction = (interaction: TimelineInteraction) => {
    interactions.push(interaction)
  }

  const collectTaskSegments = (taskItem: Task) => {
    const segments: Array<{ start: string; end: string }> = [
      { start: taskItem.startTime, end: taskItem.endTime }
    ]
    const events = taskItem.events ?? []
    const askIndex = events.findIndex((event) => event.type === 'tool__AskUserQuestion')
    if (askIndex < 0) return segments
    const askEvent = events[askIndex]
    const askStartTime = parseTime(askEvent.startTime) <= parseTime(askEvent.endTime)
      ? askEvent.startTime
      : askEvent.endTime
    const askEndTime = parseTime(askEvent.startTime) <= parseTime(askEvent.endTime)
      ? askEvent.endTime
      : askEvent.startTime
    if (parseTime(askEndTime) <= parseTime(askStartTime)) return segments
    segments[segments.length - 1] = {
      start: segments[segments.length - 1].start,
      end: askStartTime
    }
    segments.push({
      start: askEndTime,
      end: taskItem.endTime
    })
    return segments
  }

  const walkEvents = (events: TimelineEvent[]) => {
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index]
      const { type, startTime, endTime } = event
      switch (type) {
        case 'tool__StartTasks': {
          const { tasks = {} } = event
          const startTasksSectionId = nextSectionId('section')
          const startTasksSectionLabel = nextBlankSectionLabel()
          for (const [taskName, task] of Object.entries(tasks)) {
            const segments = collectTaskSegments(task)
            segments.forEach((segment, segmentIndex) => {
              const itemId = nextId('task')
              const label = segments.length > 1
                ? `${taskName} - ${segmentIndex}`
                : taskName
              const interaction: TimelineInteraction = {
                id: itemId,
                label: taskName,
                payload: {
                  kind: 'task',
                  name: taskName,
                  task
                }
              }
              items.push({
                id: itemId,
                label,
                start: normalizeTime(segment.start),
                end: normalizeTime(segment.end),
                sectionId: startTasksSectionId,
                sectionLabel: startTasksSectionLabel,
                type: 'task',
                interaction
              })
              addInteraction(interaction)
            })
            const { events: taskEvents = [] } = task
            if (taskEvents.length > 0) {
              walkEvents(taskEvents)
            }
          }
          break
        }
        case 'tool__ResumeTask': {
          break
        }
        case 'user__Prompt': {
          break
        }
        default:
          break
      }
    }
  }

  const mainItemId = nextId('main')
  const mainSectionId = nextSectionId('section')
  items.push({
    id: mainItemId,
    label: labels.ganttMainSection,
    start: normalizeTime(task.startTime),
    end: normalizeTime(task.endTime),
    sectionId: mainSectionId,
    sectionLabel: labels.ganttMainSection,
    type: 'task'
  })
  walkEvents(task.events ?? [])
  return {
    items,
    interactions
  }
}

function buildGanttLines(items: GanttItem[]) {
  const lines = [
    'gantt',
    'dateFormat HH:mm:ss',
    'axisFormat %H:%M:%S'
  ]

  const sections = new Map<string, { label: string; items: GanttItem[] }>()
  for (const item of items) {
    if (!sections.has(item.sectionId)) {
      sections.set(item.sectionId, { label: item.sectionLabel, items: [] })
    }
    sections.get(item.sectionId)?.items.push(item)
  }

  for (const section of sections.values()) {
    lines.push(section.label ? `section ${section.label}` : 'section')
    for (const item of section.items) {
      if (item.end) {
        lines.push(`${item.label} :${item.id}, ${item.start}, ${item.end}`)
      }
    }
  }

  return lines.join('\n')
}

export function buildGantt(task: Task, labels: GanttLabels): TimelineDiagram {
  const { items, interactions } = collectGanttItems(task, labels)
  return {
    code: buildGanttLines(items),
    interactions
  }
}
