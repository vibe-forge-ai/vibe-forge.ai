import { Button, List, Tooltip } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import type { SkillHubItem } from '#~/api.js'
import { SkillHubResultItem } from './SkillHubResultItem'

const PREFETCH_ROOT_MARGIN = '640px'

interface SkillMarketResultsProps {
  canLoadMore: boolean
  hubItems: SkillHubItem[]
  installingId: string | null
  loadingMore: boolean
  resetKey: string
  onInstall: (item: SkillHubItem) => void
  onLoadMore: () => void
}

export function SkillMarketResults({
  canLoadMore,
  hubItems,
  installingId,
  loadingMore,
  resetKey,
  onInstall,
  onLoadMore
}: SkillMarketResultsProps) {
  const { t } = useTranslation()
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const sentinelRef = React.useRef<HTMLDivElement | null>(null)
  const requestPendingRef = React.useRef(false)

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    requestPendingRef.current = false
  }, [resetKey])

  React.useEffect(() => {
    if (!loadingMore) {
      requestPendingRef.current = false
    }
  }, [loadingMore])

  const requestLoadMore = React.useCallback(() => {
    if (!canLoadMore || loadingMore || requestPendingRef.current) return
    requestPendingRef.current = true
    onLoadMore()
  }, [canLoadMore, loadingMore, onLoadMore])

  React.useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollRef.current
    if (sentinel == null || root == null || !canLoadMore) return

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      requestLoadMore()
    }, {
      root,
      rootMargin: PREFETCH_ROOT_MARGIN
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [canLoadMore, requestLoadMore])

  return (
    <div className='knowledge-base-view__skill-results'>
      <div ref={scrollRef} className='knowledge-base-view__skill-results-scroll'>
        <List
          className='knowledge-base-view__list knowledge-base-view__skill-market-list'
          dataSource={hubItems}
          renderItem={(item) => (
            <SkillHubResultItem
              item={item}
              installing={installingId === item.id}
              onInstall={onInstall}
            />
          )}
        />
        {(canLoadMore || loadingMore) && (
          <div ref={sentinelRef} className='knowledge-base-view__skill-load-more'>
            <Tooltip title={loadingMore ? t('knowledge.skills.loadingMore') : t('knowledge.skills.loadMore')}>
              <Button
                className='knowledge-base-view__skill-load-more-button'
                type='text'
                loading={loadingMore}
                disabled={loadingMore}
                onClick={requestLoadMore}
                icon={<span className='material-symbols-rounded'>expand_more</span>}
              />
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
