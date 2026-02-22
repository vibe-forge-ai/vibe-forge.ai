import './index.scss'

import React from 'react'
import { useTranslation } from 'react-i18next'

import type { ChatMessage } from '@vibe-forge/core'

import { buildGantt, buildGitGraph } from './mermaid'
import type { Task } from './types'

export function SessionTimelinePanel({
  messages: _messages,
  isThinking: _isThinking,
  task,
  viewMode
}: {
  messages: ChatMessage[]
  isThinking: boolean
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
      const styles = getComputedStyle(document.documentElement)
      const dangerColor = styles.getPropertyValue('--danger-color').trim()
      const textColor = styles.getPropertyValue('--text-color').trim()
      const bgColor = styles.getPropertyValue('--bg-color').trim()
      const subBgColor = styles.getPropertyValue('--sub-bg-color').trim()
      const primaryColor = styles.getPropertyValue('--primary-color').trim()
      const warningColor = styles.getPropertyValue('--warning-color').trim()
      const successColor = styles.getPropertyValue('--success-color').trim()
      const fontFamily = getComputedStyle(document.body).fontFamily
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'dark',
        themeVariables: {
          primaryColor: subBgColor,
          primaryTextColor: textColor,
          primaryBorderColor: dangerColor,
          lineColor: dangerColor,
          secondaryColor: bgColor,
          secondaryBorderColor: dangerColor,
          fontFamily,
          git0: dangerColor,
          git1: primaryColor,
          git2: warningColor,
          git3: successColor
        },
        flowchart: {
          curve: 'linear'
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
    <div className='session-timeline-panel'>
      <div ref={containerRef} className='session-timeline-mermaid' />
    </div>
  )
}
