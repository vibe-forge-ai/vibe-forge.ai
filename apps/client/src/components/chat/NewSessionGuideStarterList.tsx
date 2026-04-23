import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ConversationStarterConfig } from '@vibe-forge/types'

import { NewSessionGuideStarterSection } from './NewSessionGuideStarterSection'
import { buildConversationStarterListItems, partitionConversationStarterListItems } from './new-session-guide-config'

const FAVORITE_STARTER_STORAGE_KEY = 'vf_new_session_guide_favorites'
const RECENT_STARTER_STORAGE_KEY = 'vf_new_session_guide_recent'
const DEFAULT_VISIBLE_STARTER_COUNT = 8
const MAX_RECENT_STARTER_COUNT = 3

const readStoredStarterKeys = (storageKey: string) => {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw == null) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

const areListsEqual = (left: string[], right: string[]) => (
  left.length === right.length && left.every((value, index) => value === right[index])
)

export function NewSessionGuideStarterList({
  startupPresets,
  builtinActions,
  onApplyStarter
}: {
  startupPresets: ConversationStarterConfig[]
  builtinActions: ConversationStarterConfig[]
  onApplyStarter: (starter: ConversationStarterConfig) => void
}) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [showAllRemaining, setShowAllRemaining] = useState(false)
  const [searchPinnedHeight, setSearchPinnedHeight] = useState<number | null>(null)
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>(() => readStoredStarterKeys(FAVORITE_STARTER_STORAGE_KEY))
  const [recentKeys, setRecentKeys] = useState<string[]>(() => readStoredStarterKeys(RECENT_STARTER_STORAGE_KEY))
  const sectionsRef = useRef<HTMLDivElement | null>(null)
  const starterItems = useMemo(
    () => buildConversationStarterListItems(startupPresets, builtinActions),
    [builtinActions, startupPresets]
  )
  const visibleStarterState = useMemo(
    () =>
      partitionConversationStarterListItems({
        items: starterItems,
        favoriteKeys,
        recentKeys,
        query: searchQuery,
        remainingLimit: showAllRemaining ? starterItems.length : DEFAULT_VISIBLE_STARTER_COUNT
      }),
    [favoriteKeys, recentKeys, searchQuery, showAllRemaining, starterItems]
  )

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITE_STARTER_STORAGE_KEY, JSON.stringify(favoriteKeys))
      localStorage.setItem(RECENT_STARTER_STORAGE_KEY, JSON.stringify(recentKeys))
    } catch {}
  }, [favoriteKeys, recentKeys])

  useEffect(() => {
    const validKeySet = new Set(starterItems.map(item => item.key))
    setFavoriteKeys((prev) => {
      const next = prev.filter(key => validKeySet.has(key))
      return areListsEqual(prev, next) ? prev : next
    })
    setRecentKeys((prev) => {
      const next = prev.filter(key => validKeySet.has(key)).slice(0, MAX_RECENT_STARTER_COUNT)
      return areListsEqual(prev, next) ? prev : next
    })
  }, [starterItems])

  useEffect(() => {
    setShowAllRemaining(false)
  }, [searchQuery])

  useEffect(() => {
    if (!visibleStarterState.isSearchMode && searchPinnedHeight != null) {
      setSearchPinnedHeight(null)
    }
  }, [searchPinnedHeight, visibleStarterState.isSearchMode])

  if (starterItems.length === 0) return null

  const handleToggleFavorite = (key: string) => {
    setFavoriteKeys(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key])
  }

  const handleApplyListItem = (item: typeof starterItems[number]) => {
    setRecentKeys(prev => [item.key, ...prev.filter(key => key !== item.key)].slice(0, MAX_RECENT_STARTER_COUNT))
    onApplyStarter(item.starter)
  }
  const isExpanded = showAllRemaining && !visibleStarterState.isSearchMode
  const shouldShowExpand = !visibleStarterState.isSearchMode && visibleStarterState.hiddenRemainingCount > 0
  const shouldShowCollapse = !visibleStarterState.isSearchMode &&
    showAllRemaining &&
    visibleStarterState.totalRemainingCount > DEFAULT_VISIBLE_STARTER_COUNT
  const shouldShowFooter = shouldShowExpand || shouldShowCollapse
  const sectionsStyle = visibleStarterState.isSearchMode && searchPinnedHeight != null
    ? { minHeight: `${searchPinnedHeight}px` }
    : undefined

  const handleSearchChange = (nextQuery: string) => {
    if (searchQuery.length === 0 && nextQuery.length > 0) {
      const nextHeight = sectionsRef.current?.getBoundingClientRect().height
      if (nextHeight != null && Number.isFinite(nextHeight)) {
        setSearchPinnedHeight(Math.round(nextHeight))
      }
    }
    if (nextQuery.length === 0) {
      setSearchPinnedHeight(null)
    }
    setSearchQuery(nextQuery)
  }

  return (
    <div
      ref={sectionsRef}
      style={sectionsStyle}
      className={['new-session-guide__sections', isExpanded ? 'is-expanded' : ''].filter(Boolean).join(' ')}
    >
      <div
        className={['new-session-guide__sections-header', isExpanded ? 'is-expanded' : ''].filter(Boolean).join(' ')}
      >
        <label className='new-session-guide__search'>
          <span className='material-symbols-rounded new-session-guide__search-icon'>search</span>
          <input
            type='search'
            className='new-session-guide__search-input'
            value={searchQuery}
            placeholder={t('chat.newSessionGuide.searchPlaceholder')}
            onChange={event => handleSearchChange(event.target.value)}
          />
        </label>
      </div>
      <div className={['new-session-guide__sections-body', isExpanded ? 'is-expanded' : ''].filter(Boolean).join(' ')}>
        {!visibleStarterState.isSearchMode && (
          <NewSessionGuideStarterSection
            items={visibleStarterState.favorites}
            label={t('chat.newSessionGuide.favoriteTitle')}
            favoriteKeys={favoriteKeys}
            recentKeys={visibleStarterState.recentKeys}
            onToggleFavorite={handleToggleFavorite}
            onApplyStarter={handleApplyListItem}
          />
        )}
        {visibleStarterState.visibleRemaining.length > 0 && (
          <NewSessionGuideStarterSection
            items={visibleStarterState.visibleRemaining}
            favoriteKeys={favoriteKeys}
            recentKeys={visibleStarterState.recentKeys}
            showRecentBadge={!visibleStarterState.isSearchMode}
            onToggleFavorite={handleToggleFavorite}
            onApplyStarter={handleApplyListItem}
          />
        )}
        {visibleStarterState.isSearchMode && visibleStarterState.visibleRemaining.length === 0 && (
          <div className='new-session-guide__empty-search'>{t('chat.newSessionGuide.emptySearch')}</div>
        )}
      </div>
      {shouldShowFooter && (
        <div className='new-session-guide__sections-footer'>
          {shouldShowExpand && (
            <button type='button' className='new-session-guide__more-button' onClick={() => setShowAllRemaining(true)}>
              {t('chat.newSessionGuide.showMore', { count: visibleStarterState.hiddenRemainingCount })}
            </button>
          )}
          {shouldShowCollapse && (
            <button
              type='button'
              className='new-session-guide__more-button is-secondary'
              onClick={() => setShowAllRemaining(false)}
            >
              {t('chat.newSessionGuide.showLess')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
