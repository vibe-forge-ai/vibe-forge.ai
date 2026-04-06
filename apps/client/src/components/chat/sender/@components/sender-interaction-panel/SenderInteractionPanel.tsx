import './SenderInteractionPanel.scss'

import { Button, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import type { AskUserQuestionParams } from '@vibe-forge/core'
import type { PermissionInteractionContext } from '@vibe-forge/types'

const renderInfoButton = (title: string) => (
  <Tooltip title={title} placement='top' destroyOnHidden>
    <span
      className='material-symbols-rounded interaction-panel__info-trigger'
      aria-label={title}
      role='img'
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      info
    </span>
  </Tooltip>
)

export function SenderInteractionPanel({
  interactionRequest,
  permissionContext,
  deniedTools,
  reasons,
  onInteractionResponse
}: {
  interactionRequest: { id: string; payload: AskUserQuestionParams }
  permissionContext?: PermissionInteractionContext
  deniedTools: string[]
  reasons: string[]
  onInteractionResponse?: (id: string, data: string | string[]) => void
}) {
  const { t } = useTranslation()

  return (
    <div className='interaction-panel'>
      {permissionContext != null && (
        <div className='interaction-panel__badge'>
          <span className='material-symbols-rounded'>lock</span>
          <span>{t('chat.permissionRequestBadge')}</span>
        </div>
      )}
      <div className='interaction-question'>
        {interactionRequest.payload.question}
      </div>
      {permissionContext != null && (
        <div className='interaction-panel__context'>
          <div className='interaction-panel__info-list'>
            {permissionContext.currentMode != null && (
              <div className='interaction-panel__info-row'>
                <span className='interaction-panel__meta-label'>{t('chat.permissionCurrentMode')}</span>
                <code className='interaction-panel__meta-value'>{permissionContext.currentMode}</code>
              </div>
            )}
            {permissionContext.suggestedMode != null && (
              <div className='interaction-panel__info-row'>
                <span className='interaction-panel__meta-label'>{t('chat.permissionSuggestedMode')}</span>
                <code className='interaction-panel__meta-value'>{permissionContext.suggestedMode}</code>
              </div>
            )}
            {deniedTools.length > 0 && (
              <div className='interaction-panel__info-row interaction-panel__info-row--wrap'>
                <span className='interaction-panel__meta-label'>{t('chat.permissionDeniedTools')}</span>
                <div className='interaction-panel__chips'>
                  {deniedTools.map(tool => (
                    <code key={tool} className='interaction-panel__chip'>{tool}</code>
                  ))}
                </div>
              </div>
            )}
            {reasons.length > 0 && (
              <div className='interaction-panel__info-row interaction-panel__info-row--wrap'>
                <span className='interaction-panel__meta-label'>{t('chat.permissionReasons')}</span>
                <div className='interaction-panel__reason-list'>
                  {reasons.map(reason => (
                    <span key={reason} className='interaction-panel__reason-pill'>{reason}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className='interaction-panel__options'>
        {interactionRequest.payload.options?.map((option: { label: string; value?: string; description?: string }) => (
          <Button
            key={option.value ?? option.label}
            block
            className='interaction-panel__option'
            onClick={() => onInteractionResponse?.(interactionRequest.id, option.value ?? option.label)}
          >
            <span className='interaction-panel__option-main'>
              <span className='interaction-panel__option-label'>{option.label}</span>
              {option.description && (
                <span className='interaction-panel__option-side'>
                  {renderInfoButton(option.description)}
                </span>
              )}
            </span>
          </Button>
        ))}
      </div>
    </div>
  )
}
