import './index.scss'

import React from 'react'
import { useTranslation } from 'react-i18next'

import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'
import { buildGantt, buildGitGraph } from './mermaid'
import type { Task } from './types'

export interface SessionTimelinePanelProps {
  task: Task
  viewMode: 'git' | 'gantt'
  className?: string
  style?: React.CSSProperties
}

const getCompactTimelineLabels = <
  T extends {
    allTasksDone: string
    askUserQuestion: string
    ganttMainSection: string
    mainEnd: string
    mainStart: string
    receiveReply: string
    resumeTask: string
    startTasks: string
    taskEnd: string
    taskStart: string
    userAnswer: string
    userPrompt: string
  },
>(labels: T, isZh: boolean) => {
  if (isZh) {
    return {
      ...labels,
      mainStart: '启动',
      mainEnd: '结束',
      startTasks: '任务',
      allTasksDone: '完成',
      askUserQuestion: '提问',
      resumeTask: '继续',
      userPrompt: '提示',
      userAnswer: '回答',
      receiveReply: '回复',
      taskStart: '开始',
      taskEnd: '结束',
      ganttMainSection: '主'
    }
  }

  return {
    ...labels,
    mainStart: 'Start',
    mainEnd: 'End',
    startTasks: 'Tasks',
    allTasksDone: 'Done',
    askUserQuestion: 'Ask',
    resumeTask: 'Resume',
    userPrompt: 'Prompt',
    userAnswer: 'Answer',
    receiveReply: 'Reply',
    taskStart: 'Start',
    taskEnd: 'End',
    ganttMainSection: 'Main'
  }
}

export function SessionTimelinePanel(props: SessionTimelinePanelProps) {
  const {
    task,
    viewMode,
    className,
    style
  } = props
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const { t, i18n } = useTranslation()
  const { isCompactLayout } = useResponsiveLayout()
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
  const diagramLabels = React.useMemo(
    () =>
      isCompactLayout
        ? getCompactTimelineLabels(labels, i18n.resolvedLanguage?.startsWith('zh') === true)
        : labels,
    [i18n.resolvedLanguage, isCompactLayout, labels]
  )
  const diagram = React.useMemo(() => {
    if (viewMode === 'gantt') {
      return buildGantt(task, diagramLabels, { compact: isCompactLayout })
    }
    return buildGitGraph(task, diagramLabels, { compact: isCompactLayout })
  }, [diagramLabels, isCompactLayout, task, viewMode])
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
          fontFamily,
          fontSize: isCompactLayout ? '12px' : '14px'
        },
        gitGraph: isCompactLayout
          ? {
            rotateCommitLabel: false,
            showBranches: false
          }
          : {},
        gantt: {
          topAxis: true,
          displayMode: 'compact',
          gridLineStartPadding: 0,
          leftPadding: isCompactLayout ? 8 : 16,
          rightPadding: isCompactLayout ? 8 : 16,
          topPadding: isCompactLayout ? 28 : 36,
          barHeight: isCompactLayout ? 16 : 20,
          barGap: isCompactLayout ? 3 : 4,
          fontSize: isCompactLayout ? 10 : 11,
          sectionFontSize: isCompactLayout ? 10 : 11
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
  }, [diagram.interactions, isCompactLayout, mermaidCode, safeDiagramId])

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
      className={[
        'session-timeline-panel',
        `session-timeline-panel--${viewMode}`,
        isCompactLayout ? 'session-timeline-panel--compact' : '',
        className ?? ''
      ].filter(Boolean).join(' ')}
      style={style}
    />
  )
}
