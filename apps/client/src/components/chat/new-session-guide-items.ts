import type { ConfigResponse, ConversationStarterConfig } from '@vibe-forge/types'

import { collectVisibleRecentKeys, filterUniqueStrings, orderItemsByPriorityKeys } from './new-session-guide-list-order'

export interface NewSessionGuideData {
  announcements: string[]
  startupPresets: ConversationStarterConfig[]
  builtinActions: ConversationStarterConfig[]
}

export type ConversationStarterCollectionKey = 'startupPresets' | 'builtinActions'

export interface ConversationStarterListItem {
  key: string
  order: number
  source: ConversationStarterCollectionKey
  sourceIndex: number
  starter: ConversationStarterConfig
}

export interface PartitionConversationStarterListItemsResult {
  isSearchMode: boolean
  favorites: ConversationStarterListItem[]
  recentKeys: string[]
  visibleRemaining: ConversationStarterListItem[]
  totalRemainingCount: number
  hiddenRemainingCount: number
}

const trimText = (value: string | undefined) => value?.trim() ?? ''

export const getNewSessionGuideData = (configRes?: ConfigResponse): NewSessionGuideData => {
  const general = configRes?.sources?.merged?.general
  const conversation = configRes?.sources?.merged?.conversation

  return {
    announcements: general?.announcements ?? [],
    startupPresets: conversation?.startupPresets ?? [],
    builtinActions: conversation?.builtinActions ?? []
  }
}

const buildConversationStarterListItemKey = (
  starter: ConversationStarterConfig,
  source: ConversationStarterCollectionKey,
  sourceIndex: number
) => {
  const id = trimText(starter.id)
  if (id !== '') {
    return `${source}:${id}`
  }

  const fingerprint = [
    trimText(starter.title),
    trimText(starter.target),
    trimText(starter.prompt)
  ].filter(value => value !== '')

  if (fingerprint.length > 0) {
    return `${source}:${fingerprint.join('|')}`
  }

  return `${source}:index:${sourceIndex}`
}

export const buildConversationStarterListItems = (
  startupPresets: ConversationStarterConfig[],
  builtinActions: ConversationStarterConfig[]
): ConversationStarterListItem[] => {
  let order = 0

  return [
    ...startupPresets.map((starter, sourceIndex) => ({
      key: buildConversationStarterListItemKey(starter, 'startupPresets', sourceIndex),
      order: order++,
      source: 'startupPresets' as const,
      sourceIndex,
      starter
    })),
    ...builtinActions.map((starter, sourceIndex) => ({
      key: buildConversationStarterListItemKey(starter, 'builtinActions', sourceIndex),
      order: order++,
      source: 'builtinActions' as const,
      sourceIndex,
      starter
    }))
  ]
}

const normalizeSearchQuery = (value: string) => value.trim().toLowerCase()

const buildConversationStarterSearchText = (item: ConversationStarterListItem) => {
  const { starter } = item

  return [
    trimText(starter.title),
    trimText(starter.description),
    trimText(starter.prompt),
    trimText(starter.target),
    trimText(starter.targetLabel),
    trimText(starter.targetDescription),
    trimText(starter.model),
    ...(starter.files?.map(path => trimText(path)) ?? []),
    ...(starter.rules?.map(rule => trimText(rule)) ?? []),
    ...(starter.skills?.map(skill => trimText(skill)) ?? [])
  ]
    .filter(value => value !== '')
    .join(' ')
    .toLowerCase()
}

export const partitionConversationStarterListItems = ({
  items,
  favoriteKeys,
  recentKeys,
  query,
  remainingLimit
}: {
  items: ConversationStarterListItem[]
  favoriteKeys: string[]
  recentKeys: string[]
  query: string
  remainingLimit: number
}): PartitionConversationStarterListItemsResult => {
  const normalizedQuery = normalizeSearchQuery(query)
  if (normalizedQuery !== '') {
    const searchTerms = normalizedQuery.split(/\s+/).filter(term => term !== '')
    const matchedItems = items.filter((item) => {
      const searchText = buildConversationStarterSearchText(item)
      return searchTerms.every(term => searchText.includes(term))
    })

    return {
      isSearchMode: true,
      favorites: [],
      recentKeys: [],
      visibleRemaining: matchedItems,
      totalRemainingCount: matchedItems.length,
      hiddenRemainingCount: 0
    }
  }

  const favoriteSet = new Set(filterUniqueStrings(favoriteKeys))
  const itemByKey = new Map(items.map(item => [item.key, item]))
  const recentKeysByPriority = collectVisibleRecentKeys(recentKeys, new Set(itemByKey.keys()), 3)

  const favorites = orderItemsByPriorityKeys(
    items.filter(item => favoriteSet.has(item.key)),
    recentKeysByPriority
  )
  const favoriteKeySet = new Set(favorites.map(item => item.key))
  const recentRemainingKeys = recentKeysByPriority.filter(key => !favoriteKeySet.has(key))
  const hiddenKeySet = new Set([...favoriteKeySet, ...recentRemainingKeys])
  const remaining = orderItemsByPriorityKeys(
    items.filter(item => !hiddenKeySet.has(item.key)),
    []
  )
  const safeLimit = Math.max(0, remainingLimit)
  const visibleRemaining = [
    ...recentRemainingKeys.map(key => itemByKey.get(key)).filter(Boolean),
    ...remaining
  ] as ConversationStarterListItem[]

  return {
    isSearchMode: false,
    favorites,
    recentKeys: recentKeysByPriority,
    visibleRemaining: visibleRemaining.slice(0, safeLimit),
    totalRemainingCount: visibleRemaining.length,
    hiddenRemainingCount: Math.max(0, visibleRemaining.length - safeLimit)
  }
}
