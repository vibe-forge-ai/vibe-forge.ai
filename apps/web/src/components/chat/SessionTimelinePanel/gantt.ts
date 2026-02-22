import type { Task, TimelineEvent } from './types'
import { normalizeTime } from './utils'

interface GanttItem {
  id: string
  label: string
  start: string
  end?: string
  section: string
  type: 'task'
}

interface GanttLabels {
  ganttTitle: string
  ganttMainSection: string
  ganttTasksSection: string
  askUserQuestion: string
  userAnswer: string
  receiveReply: string
}

function createGanttItemIdFactory() {
  let seq = 0
  return (prefix: string) => `${prefix}_${seq++}`
}

function collectGanttItems(task: Task, labels: GanttLabels) {
  const nextId = createGanttItemIdFactory()
  const items: GanttItem[] = [
    {
      id: nextId('main'),
      label: labels.ganttMainSection,
      start: normalizeTime(task.startTime),
      end: normalizeTime(task.endTime),
      section: labels.ganttMainSection,
      type: 'task'
    }
  ]

  const walkEvents = (events: TimelineEvent[], section: string, parentSection: string) => {
    for (const event of events) {
      const { type, startTime, endTime } = event
      switch (type) {
        case 'tool__StartTasks': {
          const { tasks = {} } = event
          for (const [taskName, task] of Object.entries(tasks)) {
            items.push({
              id: nextId('task'),
              label: taskName,
              start: normalizeTime(task.startTime),
              end: normalizeTime(task.endTime),
              section,
              type: 'task'
            })
            const { events: taskEvents = [] } = task
            if (taskEvents.length > 0) {
              walkEvents(taskEvents, taskName, section)
            }
          }
          break
        }
        case 'tool__AskUserQuestion':
          items.push({
            id: nextId('ask'),
            label: labels.askUserQuestion,
            start: normalizeTime(startTime),
            end: normalizeTime(endTime),
            section,
            type: 'task'
          })
          items.push({
            id: nextId('answer'),
            label: labels.receiveReply,
            start: normalizeTime(endTime),
            end: normalizeTime(endTime),
            section,
            type: 'task'
          })
          items.push({
            id: nextId('parentAnswer'),
            label: labels.userAnswer,
            start: normalizeTime(endTime),
            end: normalizeTime(endTime),
            section: parentSection,
            type: 'task'
          })
          break
        default:
          break
      }
    }
  }

  walkEvents(task.events ?? [], labels.ganttTasksSection, labels.ganttMainSection)
  return items
}

function buildGanttLines(items: GanttItem[], labels: GanttLabels) {
  const lines = [
    'gantt',
    `title ${labels.ganttTitle}`,
    'dateFormat HH:mm:ss',
    'axisFormat %H:%M:%S'
  ]

  const sections = new Map<string, GanttItem[]>()
  for (const item of items) {
    if (!sections.has(item.section)) {
      sections.set(item.section, [])
    }
    sections.get(item.section)?.push(item)
  }

  for (const [section, sectionItems] of sections.entries()) {
    lines.push(`section ${section}`)
    for (const item of sectionItems) {
      if (item.end) {
        lines.push(`${item.label} :${item.id}, ${item.start}, ${item.end}`)
      }
    }
  }

  return lines.join('\n')
}

export function buildGantt(task: Task, labels: GanttLabels) {
  const items = collectGanttItems(task, labels)
  return buildGanttLines(items, labels)
}
