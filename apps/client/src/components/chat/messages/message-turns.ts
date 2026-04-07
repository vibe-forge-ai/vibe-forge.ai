import type { ChatRenderItem } from './message-utils'

interface MessageTurnDraft {
  id: string
  items: ChatRenderItem[]
  startedByUser: boolean
}

export interface MessageTurn {
  durationMs: number | null
  hiddenCount: number
  id: string
  isCollapsed: boolean
  isExpandable: boolean
  items: ChatRenderItem[]
  visibleItems: ChatRenderItem[]
}

const isUserTurnStarter = (item: ChatRenderItem) => {
  return item.type === 'message' && item.originalMessage.role === 'user'
}

export const buildMessageTurns = (params: {
  expandedTurnIds: Set<string>
  hashAnchorId?: string
  keepLastTurnExpanded: boolean
  renderItems: ChatRenderItem[]
}): MessageTurn[] => {
  const drafts: MessageTurnDraft[] = []
  let currentDraft: MessageTurnDraft | null = null

  for (const item of params.renderItems) {
    if (isUserTurnStarter(item)) {
      if (currentDraft != null) {
        drafts.push(currentDraft)
      }

      currentDraft = {
        id: item.originalMessage.id,
        items: [item],
        startedByUser: true
      }
      continue
    }

    if (currentDraft == null) {
      currentDraft = {
        id: `orphan:${item.anchorId}`,
        items: [item],
        startedByUser: false
      }
      continue
    }

    currentDraft.items.push(item)
  }

  if (currentDraft != null) {
    drafts.push(currentDraft)
  }

  return drafts.map((draft, index) => {
    const isLastTurn = index === drafts.length - 1
    const startTimestamp = draft.items[0]?.originalMessage.createdAt ?? null
    const endTimestamp = draft.items[draft.items.length - 1]?.originalMessage.createdAt ?? null
    const hiddenCount = Math.max(draft.items.length - 2, 0)
    const isExpandable = draft.startedByUser && hiddenCount > 0
    const hasHashTarget = params.hashAnchorId != null && params.hashAnchorId !== ''
      ? draft.items.some((item) => item.anchorId === params.hashAnchorId)
      : false
    const shouldCollapseByDefault = isExpandable && !(isLastTurn && params.keepLastTurnExpanded)
    const isCollapsed = shouldCollapseByDefault && !params.expandedTurnIds.has(draft.id) && !hasHashTarget

    return {
      durationMs: startTimestamp != null && endTimestamp != null
        ? Math.max(endTimestamp - startTimestamp, 0)
        : null,
      hiddenCount,
      id: draft.id,
      isCollapsed,
      isExpandable,
      items: draft.items,
      visibleItems: isCollapsed
        ? [draft.items[0]!, draft.items[draft.items.length - 1]!]
        : draft.items
    }
  })
}
