import { Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import type { ConversationStarterConfig } from '@vibe-forge/types'

import type { ConversationStarterListItem } from './new-session-guide-config'
import { normalizeConversationStarterMode } from './new-session-guide-config'

const trimText = (value: string | undefined) => value?.trim() ?? ''

const resolveStarterIcon = (starter: ConversationStarterConfig) => {
  const customIcon = trimText(starter.icon)
  if (customIcon !== '') return customIcon

  switch (normalizeConversationStarterMode(starter.mode)) {
    case 'workspace':
      return 'workspaces'
    case 'entity':
      return 'group_work'
    case 'spec':
      return 'account_tree'
    default:
      return 'bolt'
  }
}

const buildFallbackTitle = (
  item: ConversationStarterListItem,
  presetPrefix: string,
  actionPrefix: string
) => {
  const title = trimText(item.starter.title)
  if (title !== '') return title
  return `${item.source === 'builtinActions' ? actionPrefix : presetPrefix} #${item.sourceIndex + 1}`
}

export function NewSessionGuideStarterSection({
  items,
  label,
  favoriteKeys,
  recentKeys,
  showRecentBadge = true,
  onToggleFavorite,
  onApplyStarter
}: {
  items: ConversationStarterListItem[]
  label?: string
  favoriteKeys: string[]
  recentKeys: string[]
  showRecentBadge?: boolean
  onToggleFavorite: (key: string) => void
  onApplyStarter: (item: ConversationStarterListItem) => void
}) {
  const { t } = useTranslation()

  if (items.length === 0) return null

  return (
    <section className='new-session-guide__section'>
      {label != null && label !== '' && <div className='new-session-guide__section-title'>{label}</div>}
      <div className='new-session-guide__list' role='list'>
        {items.map((item) => {
          const isFavorite = favoriteKeys.includes(item.key)
          const isRecent = recentKeys.includes(item.key)
          const description = trimText(item.starter.description)

          return (
            <div key={item.key} className='new-session-guide__list-row' role='listitem'>
              <Tooltip
                title={description !== '' ? description : undefined}
                placement='topLeft'
                mouseEnterDelay={2}
              >
                <button
                  type='button'
                  className='new-session-guide__list-item'
                  onClick={() => onApplyStarter(item)}
                >
                  <span className='material-symbols-rounded new-session-guide__list-item-icon'>
                    {resolveStarterIcon(item.starter)}
                  </span>
                  <span className='new-session-guide__list-item-copy'>
                    <span className='new-session-guide__list-item-title-row'>
                      <span className='new-session-guide__list-item-title'>
                        {buildFallbackTitle(
                          item,
                          t('chat.newSessionGuide.fallbackPresetPrefix'),
                          t('chat.newSessionGuide.fallbackActionPrefix')
                        )}
                      </span>
                      {showRecentBadge && isRecent && (
                        <span className='new-session-guide__status-badge'>
                          {t('chat.newSessionGuide.recentTitle')}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </Tooltip>
              <button
                type='button'
                className={['new-session-guide__favorite-button', isFavorite ? 'is-active' : ''].filter(Boolean).join(
                  ' '
                )}
                aria-label={t(
                  isFavorite ? 'chat.newSessionGuide.unfavoriteAction' : 'chat.newSessionGuide.favoriteAction'
                )}
                title={t(
                  isFavorite ? 'chat.newSessionGuide.unfavoriteAction' : 'chat.newSessionGuide.favoriteAction'
                )}
                onClick={() => onToggleFavorite(item.key)}
              >
                <span className='material-symbols-rounded'>{isFavorite ? 'star' : 'star_outline'}</span>
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
