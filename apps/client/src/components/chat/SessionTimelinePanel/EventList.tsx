import './EventList.scss'

import { Input, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import React from 'react'
import { useTranslation } from 'react-i18next'

import type { Task, TimelineEvent } from './types'
import { normalizeTime, parseTime } from './utils'

interface TimelineListItem {
  id: string
  label: string
  startTime: string
  endTime: string
  depth: number
  input?: string
  output?: string
  payload?: TimelineEvent
}

interface TimelineLabels {
  mainStart: string
  mainEnd: string
  startTasks: string
  askUserQuestion: string
  edit: string
  resumeTask: string
  userPrompt: string
}

const collectTimelineEntries = (task: Task, labels: TimelineLabels) => {
  const entries: TimelineListItem[] = []
  let counter = 0

  const addEntry = (
    label: string,
    startTime: string,
    endTime: string,
    depth: number,
    payload?: TimelineEvent
  ) => {
    entries.push({
      id: `${label}-${startTime}-${endTime}-${counter}`,
      label,
      startTime,
      endTime,
      depth,
      payload
    })
    counter += 1
  }

  const walkEvents = (events: TimelineEvent[], depth: number) => {
    for (const event of events) {
      if (event.type === 'tool__StartTasks') {
        addEntry(labels.startTasks, event.startTime, event.endTime, depth, event)
      } else if (event.type === 'tool__AskUserQuestion') {
        addEntry(labels.askUserQuestion, event.startTime, event.endTime, depth, event)
      } else if (event.type === 'tool__Edit') {
        addEntry(labels.edit, event.startTime, event.endTime, depth, event)
      } else if (event.type === 'tool__ResumeTask') {
        addEntry(labels.resumeTask, event.startTime, event.endTime, depth, event)
      } else if (event.type === 'user__Prompt') {
        addEntry(labels.userPrompt, event.startTime, event.endTime, depth, event)
      }
    }
  }

  addEntry(labels.mainStart, task.startTime, task.startTime, 0)
  walkEvents(task.events ?? [], 0)
  addEntry(labels.mainEnd, task.endTime, task.endTime, 0)

  return entries
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => {
      const diff = parseTime(a.startTime) - parseTime(b.startTime)
      if (diff !== 0) return diff
      return a.index - b.index
    })
    .map(({ index: _index, ...entry }) => entry)
}

export function SessionTimelineEventList({ task }: { task: Task }) {
  const { t } = useTranslation()
  const [query, setQuery] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [scrollY, setScrollY] = React.useState(240)
  const labels = React.useMemo(() => ({
    mainStart: t('chat.timeline.mainStart'),
    mainEnd: t('chat.timeline.mainEnd'),
    startTasks: t('chat.timeline.startTasks'),
    askUserQuestion: t('chat.timeline.askUserQuestion'),
    edit: t('chat.timeline.edit'),
    resumeTask: t('chat.timeline.resumeTask'),
    userPrompt: t('chat.timeline.userPrompt')
  }), [t])
  const items = React.useMemo(() => collectTimelineEntries(task, labels), [labels, task])
  const filteredItems = React.useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return items
    return items.filter((item) => {
      const text = `${item.label} ${item.startTime} ${item.endTime}`.toLowerCase()
      return text.includes(keyword)
    })
  }, [items, query])
  const emptyValue = t('chat.timelineEmptyValue')
  const columns: ColumnsType<TimelineListItem> = React.useMemo(() => [
    {
      title: t('chat.timelineEventName'),
      key: 'label',
      width: 180,
      render: (_value, item) => (
        <span
          className='session-timeline-event-table__label'
          style={{ paddingLeft: `${item.depth * 16}px` }}
        >
          {item.label}
        </span>
      )
    },
    {
      title: t('chat.timelineInput'),
      key: 'input',
      width: 180,
      render: (_value, item) => (
        <span className='session-timeline-event-table__value'>
          {item.input ?? emptyValue}
        </span>
      )
    },
    {
      title: t('chat.timelineOutput'),
      key: 'output',
      width: 180,
      render: (_value, item) => (
        <span className='session-timeline-event-table__value'>
          {item.output ?? emptyValue}
        </span>
      )
    },
    {
      title: t('chat.timelineTiming'),
      key: 'time',
      width: 160,
      render: (_value, item) => {
        const startTime = normalizeTime(item.startTime)
        const endTime = normalizeTime(item.endTime)
        return (
          <span className='session-timeline-event-table__time'>
            {startTime === endTime ? startTime : `${startTime} → ${endTime}`}
          </span>
        )
      }
    }
  ], [emptyValue, t])

  React.useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => {
      const header = element.querySelector<HTMLElement>('.session-timeline-event-table__header')
      const pagination = element.querySelector<HTMLElement>('.ant-table-pagination')
      const headerHeight = header?.offsetHeight ?? 0
      const paginationHeight = pagination?.offsetHeight ?? 0
      const next = Math.max(160, element.clientHeight - headerHeight - paginationHeight - 16)
      setScrollY((prev) => (prev === next ? prev : next))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className='session-timeline-event-table'>
      <div className='session-timeline-event-table__header'>
        <span className='session-timeline-event-table__title'>{t('chat.timeline.eventListTitle')}</span>
        <Input
          className='session-timeline-event-table__search'
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('chat.timeline.eventListSearch')}
        />
      </div>
      <Table<TimelineListItem>
        className='session-timeline-event-table__table'
        size='small'
        columns={columns}
        dataSource={filteredItems}
        rowKey='id'
        onRow={(record) => ({
          onClick: () => {
            if (record.payload) {
              console.warn(record.payload)
            }
          }
        })}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50']
        }}
        scroll={{ y: scrollY }}
        locale={{ emptyText: t('chat.timelineEmpty') }}
      />
    </div>
  )
}
