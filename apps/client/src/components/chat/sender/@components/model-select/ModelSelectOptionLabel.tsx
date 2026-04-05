import { Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import type { ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'

const renderModelMenuTooltip = (lines: string[]) => {
  if (lines.length === 0) {
    return null
  }

  return (
    <span className='model-menu-tooltip-content'>
      {lines.join('\n')}
    </span>
  )
}

export function ModelSelectOptionLabel({
  option,
  onToggleRecommendedModel,
  showServicePrefix = false,
  updatingRecommendedModelValue
}: {
  option: ModelSelectOption
  onToggleRecommendedModel?: (option: ModelSelectOption) => void | Promise<void>
  showServicePrefix?: boolean
  updatingRecommendedModelValue?: string
}) {
  const { t } = useTranslation()
  const isUpdatingRecommendation = updatingRecommendedModelValue === option.value
  const canToggleRecommendation = option.canToggleRecommendation && onToggleRecommendedModel != null
  const isRecommended = option.isRecommended === true
  const recommendationTooltip = option.isUserRecommended
    ? t('chat.modelRemoveRecommendation')
    : isRecommended
    ? t('chat.modelAlreadyRecommended')
    : t('chat.modelAddRecommendation')

  const labelContent = (
    <span className='model-select-menu-item-main'>
      <span className='model-select-menu-item-text'>
        {showServicePrefix && option.serviceTitle && (
          <span className='model-select-menu-item-service'>
            {option.serviceTitle}
            <span className='model-select-menu-item-separator'>/</span>
          </span>
        )}
        <span className='model-select-menu-item-title'>{option.displayLabel}</span>
      </span>
    </span>
  )

  return (
    <span className='model-select-menu-item-label'>
      {option.tooltipLines.length > 0
        ? (
          <Tooltip
            title={renderModelMenuTooltip(option.tooltipLines)}
            placement='left'
            classNames={{ root: 'model-menu-tooltip' }}
            mouseEnterDelay={.35}
            destroyOnHidden
          >
            {labelContent}
          </Tooltip>
        )
        : labelContent}
      {canToggleRecommendation && (
        <Tooltip
          title={recommendationTooltip}
          destroyOnHidden
        >
          <button
            type='button'
            className={[
              'model-select-favorite-btn',
              isRecommended ? 'is-active' : '',
              isUpdatingRecommendation ? 'is-updating' : ''
            ].filter(Boolean).join(' ')}
            aria-label={recommendationTooltip}
            aria-pressed={isRecommended}
            disabled={isUpdatingRecommendation}
            tabIndex={-1}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (isRecommended && !option.isUserRecommended) {
                return
              }
              void onToggleRecommendedModel(option)
            }}
          >
            <span className='material-symbols-rounded'>
              {isUpdatingRecommendation
                ? 'progress_activity'
                : isRecommended
                ? 'star'
                : 'star_outline'}
            </span>
          </button>
        </Tooltip>
      )}
    </span>
  )
}
