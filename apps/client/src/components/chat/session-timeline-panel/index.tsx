import './index.scss'

import React from 'react'
import { useTranslation } from 'react-i18next'

import { buildGantt, buildGitGraph } from './mermaid'
import type { Task } from './types'

export interface SessionTimelinePanelProps {
  task: Task
  viewMode: 'git' | 'gantt'
  className?: string
  style?: React.CSSProperties
}

export function SessionTimelinePanel(props: SessionTimelinePanelProps) {
  const {
    task,
    viewMode,
    className,
    style
  } = props
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
  const diagram = React.useMemo(() => {
    if (viewMode === 'gantt') {
      return buildGantt(task, labels)
    }
    return buildGitGraph(task, labels)
  }, [labels, task, viewMode])
  const diagramId = React.useId()
  const safeDiagramId = React.useMemo(() => diagramId.replace(/\W/g, '_'), [diagramId])
  const interactionsRef = React.useRef(new Map<string, { label: string; payload: unknown }>())
  const mermaidCode = React.useMemo(() => diagram.code, [diagram.code])

  React.useEffect(() => {
    let cancelled = false
    const render = async () => {
      const mermaidModule = await import('mermaid')
      const mermaid = mermaidModule.default
      const fontFamily = getComputedStyle(document.body).fontFamily
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        themeVariables: {
          fontFamily
        },
        gitGraph: {},
        gantt: {
          topAxis: true,
          displayMode: 'compact',
          gridLineStartPadding: 0,
          leftPadding: 16,
          rightPadding: 16
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
        for (const interaction of diagram.interactions) {
          const target = svgElement.querySelector<HTMLElement>(`#${CSS.escape(interaction.id)}`)
          if (target) {
            target.classList.add('session-timeline-mermaid__interactive')
            target.addEventListener('click', () => {
              const item = interactionsRef.current.get(interaction.id)
              if (!item) return
              console.warn(item.payload)
            })
          }
        }
      }
      if (typeof bindFunctions === 'function') {
        bindFunctions(container)
      }
    }
    render()
    return () => {
      cancelled = true
    }
  }, [diagram.interactions, mermaidCode, safeDiagramId])

  React.useEffect(() => {
    interactionsRef.current = new Map(
      diagram.interactions.map((interaction) => [
        interaction.id,
        { label: interaction.label, payload: interaction.payload }
      ])
    )
  }, [diagram.interactions])

  return (
    <div
      ref={containerRef}
      className={`session-timeline-panel session-timeline-panel--${viewMode}${className ? ` ${className}` : ''}`}
      style={style}
    />
  )
}
