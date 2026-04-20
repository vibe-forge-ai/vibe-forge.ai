import './AiUiFeedbackLayer.scss'

import { useEffect, useRef, useState } from 'react'

import { subscribeAiUiFeedback, type AiUiFeedbackEventDetail } from './runtime'

interface FeedbackState extends AiUiFeedbackEventDetail {
  burstKey: number
  visible: boolean
}

const createHiddenState = (): FeedbackState => ({
  burstKey: 0,
  point: { x: 0, y: 0 },
  rect: { width: 0, height: 0 },
  status: 'running',
  visible: false
})

const FEEDBACK_HIDE_DELAY_MS = 1100

export function AiUiFeedbackLayer() {
  const [state, setState] = useState<FeedbackState>(createHiddenState)
  const hideTimerRef = useRef<number | null>(null)
  const burstKeyRef = useRef(0)

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
        burstKey: detail.status === 'running'
          ? burstKeyRef.current
          : ++burstKeyRef.current,
        visible: true
      })

      if (detail.status !== 'running') {
        hideTimerRef.current = window.setTimeout(() => {
          setState(createHiddenState())
          hideTimerRef.current = null
        }, FEEDBACK_HIDE_DELAY_MS)
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
      <div
        className={`ai-ui-feedback__pointer-shell ${state.status === 'running' ? '' : `is-${state.status}`}`}
        style={{ transform: pointerTransform }}
      >
        <span className='ai-ui-feedback__pointer material-symbols-rounded'>
          arrow_selector_tool
        </span>
        <span className='ai-ui-feedback__tag'>AI</span>
      </div>
      {state.status !== 'running' ? (
        <span
          key={state.burstKey}
          className={`ai-ui-feedback__burst is-${state.status}`}
          style={{ transform: pointerTransform }}
        />
      ) : null}
    </div>
  )
}
