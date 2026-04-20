import './AiUiFeedbackLayer.scss'

import { useEffect, useRef, useState } from 'react'

import { subscribeAiUiFeedback, type AiUiFeedbackEventDetail } from './runtime'

interface FeedbackState extends AiUiFeedbackEventDetail {
  visible: boolean
}

const createHiddenState = (): FeedbackState => ({
  point: { x: 0, y: 0 },
  rect: { width: 0, height: 0 },
  status: 'running',
  visible: false
})

export function AiUiFeedbackLayer() {
  const [state, setState] = useState<FeedbackState>(createHiddenState)
  const hideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    return subscribeAiUiFeedback((detail) => {
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }

      setState({
        ...detail,
        visible: true
      })

      if (detail.status !== 'running') {
        hideTimerRef.current = window.setTimeout(() => {
          setState(createHiddenState())
          hideTimerRef.current = null
        }, 260)
      }
    })
  }, [])

  if (!state.visible) {
    return null
  }

  const pointerTransform = `translate3d(${state.point.x}px, ${state.point.y}px, 0)`
  const ringWidth = Math.max(42, state.rect.width + 20)
  const ringHeight = Math.max(42, state.rect.height + 20)
  const ringTransform = `translate3d(${state.point.x - ringWidth / 2 + 10}px, ${state.point.y - ringHeight / 2 + 10}px, 0)`

  return (
    <div className='ai-ui-feedback' aria-hidden='true'>
      <div
        className={`ai-ui-feedback__ring ${state.status === 'running' ? '' : `is-${state.status}`}`}
        style={{
          height: `${ringHeight}px`,
          transform: ringTransform,
          width: `${ringWidth}px`
        }}
      />
      <span
        className={`ai-ui-feedback__pointer material-symbols-rounded ${state.status === 'running' ? '' : `is-${state.status}`}`}
        style={{ transform: pointerTransform }}
      >
        arrow_selector_tool
      </span>
    </div>
  )
}
