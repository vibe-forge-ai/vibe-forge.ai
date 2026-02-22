import './index.scss'

import React from 'react'
import { useTranslation } from 'react-i18next'

import { buildGantt, buildGitGraph } from './mermaid'
import type { Task } from './types'

export function SessionTimelinePanel({
  task,
  viewMode
}: {
  task: Task
  viewMode: 'git' | 'gantt'
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const { t } = useTranslation()
  const labels = React.useMemo(() => ({
    mainStart: t('chat.timeline.mainStart'),
    mainEnd: t('chat.timeline.mainEnd'),
    startTasks: t('chat.timeline.startTasks'),
    allTasksDone: t('chat.timeline.allTasksDone'),
    askUserQuestion: t('chat.timeline.askUserQuestion'),
    edit: t('chat.timeline.edit'),
    resumeTask: t('chat.timeline.resumeTask'),
    userPrompt: t('chat.timeline.userPrompt'),
    userAnswer: t('chat.timeline.userAnswer'),
    receiveReply: t('chat.timeline.receiveReply'),
    taskStart: t('chat.timeline.taskStart'),
    taskEnd: t('chat.timeline.taskEnd'),
    ganttTitle: t('chat.timeline.ganttTitle'),
    ganttMainSection: t('chat.timeline.ganttMainSection'),
    ganttTasksSection: t('chat.timeline.ganttTasksSection')
  }), [t])
  const mermaidCode = React.useMemo(() => {
    if (viewMode === 'gantt') {
      return buildGantt(task, labels)
    }
    return buildGitGraph(task, labels)
  }, [labels, task, viewMode])
  const diagramId = React.useId()
  const safeDiagramId = React.useMemo(() => diagramId.replace(/\W/g, '_'), [diagramId])

  React.useEffect(() => {
    let cancelled = false
    const render = async () => {
      const mermaidModule = await import('mermaid')
      const mermaid = mermaidModule.default
      const fontFamily = getComputedStyle(document.body).fontFamily
      mermaid.initialize({
        startOnLoad: false,
        themeVariables: {
          fontFamily
        }
      })
      if (cancelled) return
      const container = containerRef.current
      if (!container) return
      const { svg, bindFunctions } = await mermaid.render(safeDiagramId, mermaidCode)
      if (cancelled) return
      container.innerHTML = svg
      const svgElement = container.querySelector('svg')
      if (svgElement) {
        svgElement.classList.add('session-timeline-mermaid__svg')
      }
      if (typeof bindFunctions === 'function') {
        bindFunctions(container)
      }
    }
    render()
    return () => {
      cancelled = true
    }
  }, [mermaidCode, safeDiagramId])

  return (
    <div ref={containerRef} className='session-timeline-panel' />
  )
}
