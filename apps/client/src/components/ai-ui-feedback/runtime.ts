const AI_UI_FEEDBACK_EVENT = 'vf:ai-ui-feedback'
const AI_UI_FEEDBACK_PRE_ACTION_DELAY_MS = 240
const AI_UI_FEEDBACK_APPROACH_DELAY_MS = 280
const AI_UI_FEEDBACK_APPROACH_OFFSET = {
  x: -92,
  y: 30
}

interface FeedbackPoint {
  x: number
  y: number
}

interface FeedbackRect {
  height: number
  width: number
}

export interface AiUiFeedbackEventDetail {
  point: FeedbackPoint
  rect: FeedbackRect
  status: 'error' | 'running' | 'success'
}

interface RunAiUiActionFeedbackParams<T> {
  anchorId?: string | string[]
  execute: () => Promise<T> | T
}

const resolveAnchorSelector = (anchorId: string) => {
  const escaped = typeof window.CSS?.escape === 'function'
    ? window.CSS.escape(anchorId)
    : anchorId.replace(/["\\]/g, '\\$&')
  return `[data-ai-ui-anchor="${escaped}"]`
}

const resolveElement = (anchorId?: string | string[]) => {
  if (anchorId == null) {
    return null
  }

  const anchorIds = Array.isArray(anchorId) ? anchorId : [anchorId]
  for (const candidate of anchorIds) {
    if (candidate.trim() === '') {
      continue
    }

    const match = document.querySelector<HTMLElement>(resolveAnchorSelector(candidate))
    if (match != null) {
      return match
    }
  }

  return null
}

const resolveDetail = (anchorId?: string | string[]) => {
  const element = resolveElement(anchorId)
  const rect = element?.getBoundingClientRect()
  if (rect != null) {
    return {
      point: {
        x: rect.left + Math.min(rect.width - 12, 28),
        y: rect.top + Math.min(rect.height - 12, 28)
      },
      rect: {
        width: rect.width,
        height: rect.height
      }
    }
  }

  return {
    point: {
      x: Math.max(80, window.innerWidth * 0.5),
      y: Math.max(80, window.innerHeight * 0.25)
    },
    rect: {
      width: 0,
      height: 0
    }
  }
}

const dispatchFeedbackEvent = (detail: AiUiFeedbackEventDetail) => {
  window.dispatchEvent(new CustomEvent<AiUiFeedbackEventDetail>(AI_UI_FEEDBACK_EVENT, { detail }))
}

const wait = (timeoutMs: number) => new Promise<void>(resolve => window.setTimeout(resolve, timeoutMs))

const clampPoint = (point: FeedbackPoint): FeedbackPoint => ({
  x: Math.max(24, Math.min(window.innerWidth - 24, point.x)),
  y: Math.max(24, Math.min(window.innerHeight - 24, point.y))
})

const createApproachDetail = (detail: {
  point: FeedbackPoint
  rect: FeedbackRect
}) => ({
  point: clampPoint({
    x: detail.point.x + AI_UI_FEEDBACK_APPROACH_OFFSET.x,
    y: detail.point.y + AI_UI_FEEDBACK_APPROACH_OFFSET.y
  }),
  rect: detail.rect
})

export const runAiUiActionFeedback = async <T>({
  anchorId,
  execute
}: RunAiUiActionFeedbackParams<T>) => {
  const targetDetail = resolveDetail(anchorId)
  dispatchFeedbackEvent({
    ...createApproachDetail(targetDetail),
    status: 'running'
  })
  await wait(AI_UI_FEEDBACK_APPROACH_DELAY_MS)
  dispatchFeedbackEvent({
    ...targetDetail,
    status: 'running'
  })
  await wait(AI_UI_FEEDBACK_PRE_ACTION_DELAY_MS)

  try {
    const result = await execute()
    dispatchFeedbackEvent({
      ...resolveDetail(anchorId),
      status: 'success'
    })
    return result
  } catch (error) {
    dispatchFeedbackEvent({
      ...resolveDetail(anchorId),
      status: 'error'
    })
    throw error
  }
}

export const subscribeAiUiFeedback = (
  listener: (detail: AiUiFeedbackEventDetail) => void
) => {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<AiUiFeedbackEventDetail>
    listener(customEvent.detail)
  }

  window.addEventListener(AI_UI_FEEDBACK_EVENT, handler)
  return () => {
    window.removeEventListener(AI_UI_FEEDBACK_EVENT, handler)
  }
}
