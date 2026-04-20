import './AiUiFeedbackLayer.scss'

import { useEffect, useRef, useState } from 'react'

import { subscribeAiUiFeedback, type AiUiFeedbackEventDetail } from './runtime'

type FeedbackPhase = 'entering' | 'hidden' | 'leaving' | 'visible'

interface FeedbackState extends AiUiFeedbackEventDetail {
  burstKey: number
  burstVisible: boolean
  idle: boolean
  phase: FeedbackPhase
}

const createHiddenState = (): FeedbackState => ({
  burstKey: 0,
  burstVisible: false,
  idle: false,
  phase: 'hidden',
  point: { x: 0, y: 0 },
  rect: { width: 0, height: 0 },
  status: 'running'
})

const FEEDBACK_HIDE_DELAY_MS = 20_000
const FEEDBACK_HIDE_TRANSITION_MS = 420
const FEEDBACK_BURST_HIDE_DELAY_MS = 700
const FEEDBACK_IDLE_DELAY_MS = 1100

export function AiUiFeedbackLayer() {
  const [state, setState] = useState<FeedbackState>(createHiddenState)
  const burstTimerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const hideTransitionTimerRef = useRef<number | null>(null)
  const idleTimerRef = useRef<number | null>(null)
  const enterFrameRef = useRef<number | null>(null)
  const burstKeyRef = useRef(0)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const clearTimer = (timerRef: { current: number | null }) => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const clearEnterFrame = () => {
    if (enterFrameRef.current != null) {
      window.cancelAnimationFrame(enterFrameRef.current)
      enterFrameRef.current = null
    }
  }

  const scheduleVisiblePhase = () => {
    clearEnterFrame()
    enterFrameRef.current = window.requestAnimationFrame(() => {
      setState(prev => ({
        ...prev,
        phase: prev.phase === 'entering' ? 'visible' : prev.phase
      }))
      enterFrameRef.current = null
    })
  }

  const beginHide = () => {
    clearTimer(burstTimerRef)
    clearTimer(hideTimerRef)
    clearTimer(idleTimerRef)
    clearEnterFrame()
    setState(prev => ({
      ...prev,
      burstVisible: false,
      idle: false,
      phase: prev.phase === 'hidden' ? 'hidden' : 'leaving'
    }))
    hideTransitionTimerRef.current = window.setTimeout(() => {
      setState(createHiddenState())
      hideTransitionTimerRef.current = null
    }, FEEDBACK_HIDE_TRANSITION_MS)
  }

  useEffect(() => {
    return () => {
      clearTimer(burstTimerRef)
      clearTimer(hideTimerRef)
      clearTimer(hideTransitionTimerRef)
      clearTimer(idleTimerRef)
      clearEnterFrame()
    }
  }, [])

  useEffect(() => {
    return subscribeAiUiFeedback((detail) => {
      clearTimer(burstTimerRef)
      clearTimer(hideTimerRef)
      clearTimer(hideTransitionTimerRef)
      clearTimer(idleTimerRef)
      clearEnterFrame()

      const nextPhase = stateRef.current.phase === 'hidden' ? 'entering' : 'visible'

      setState({
        ...detail,
        burstKey: detail.status === 'running'
          ? burstKeyRef.current
          : ++burstKeyRef.current,
        burstVisible: detail.status !== 'running',
        idle: false,
        phase: nextPhase
      })

      if (nextPhase === 'entering') {
        scheduleVisiblePhase()
      }

      if (detail.status === 'running') {
        return
      }

      burstTimerRef.current = window.setTimeout(() => {
        setState(prev => ({
          ...prev,
          burstVisible: false
        }))
        burstTimerRef.current = null
      }, FEEDBACK_BURST_HIDE_DELAY_MS)

      idleTimerRef.current = window.setTimeout(() => {
        setState(prev => ({
          ...prev,
          idle: true
        }))
        idleTimerRef.current = null
      }, FEEDBACK_IDLE_DELAY_MS)

      hideTimerRef.current = window.setTimeout(() => {
        beginHide()
      }, FEEDBACK_HIDE_DELAY_MS)
    })
  }, [])

  if (state.phase === 'hidden') {
    return null
  }

  const pointerTransform = `translate3d(${state.point.x}px, ${state.point.y}px, 0)`
  const ringWidth = Math.max(42, state.rect.width + 20)
  const ringHeight = Math.max(42, state.rect.height + 20)
  const ringTransform = `translate3d(${state.point.x - ringWidth / 2 + 10}px, ${state.point.y - ringHeight / 2 + 10}px, 0)`

  return (
    <div
      className={[
        'ai-ui-feedback',
        `is-${state.phase}`,
        state.idle ? 'is-idle' : '',
        state.status === 'running' ? 'is-running' : `is-${state.status}`
      ].filter(Boolean).join(' ')}
      aria-hidden='true'
    >
      {state.status === 'running' ? (
        <div
          className='ai-ui-feedback__ring'
          style={{
            height: `${ringHeight}px`,
            transform: ringTransform,
            width: `${ringWidth}px`
          }}
        />
      ) : null}
      <div
        className='ai-ui-feedback__pointer-positioner'
        style={{ transform: pointerTransform }}
      >
        <div className='ai-ui-feedback__pointer-shell'>
          <div className='ai-ui-feedback__pointer-body'>
            <span className='ai-ui-feedback__pointer material-symbols-rounded'>
              arrow_selector_tool
            </span>
            <span className='ai-ui-feedback__tag'>AI</span>
          </div>
        </div>
      </div>
      {state.burstVisible ? (
        <span
          key={state.burstKey}
          className={`ai-ui-feedback__burst is-${state.status}`}
          style={{ transform: pointerTransform }}
        />
      ) : null}
    </div>
  )
}
