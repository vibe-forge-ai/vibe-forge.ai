import './SenderInteractionPanel.scss'

import { Button } from 'antd'
import { useTranslation } from 'react-i18next'

import type { AskUserQuestionParams } from '@vibe-forge/core'
import type { PermissionInteractionContext } from '@vibe-forge/types'

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
          <div className='interaction-panel__meta'>
            {permissionContext.currentMode != null && (
              <div className='interaction-panel__meta-item'>
                <span className='interaction-panel__meta-label'>{t('chat.permissionCurrentMode')}</span>
                <code>{permissionContext.currentMode}</code>
              </div>
            )}
            {permissionContext.suggestedMode != null && (
              <div className='interaction-panel__meta-item'>
                <span className='interaction-panel__meta-label'>{t('chat.permissionSuggestedMode')}</span>
                <code>{permissionContext.suggestedMode}</code>
              </div>
            )}
          </div>
          {deniedTools.length > 0 && (
            <div className='interaction-panel__section'>
              <div className='interaction-panel__section-title'>{t('chat.permissionDeniedTools')}</div>
              <div className='interaction-panel__chips'>
                {deniedTools.map(tool => (
                  <code key={tool} className='interaction-panel__chip'>{tool}</code>
                ))}
              </div>
            </div>
          )}
          {reasons.length > 0 && (
            <div className='interaction-panel__section'>
              <div className='interaction-panel__section-title'>{t('chat.permissionReasons')}</div>
              <div className='interaction-panel__reasons'>
                {reasons.map(reason => (
                  <div key={reason} className='interaction-panel__reason'>{reason}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {interactionRequest.payload.options?.map((option: { label: string; value?: string; description?: string }) => (
        <Button
          key={option.value ?? option.label}
          block
          className='interaction-panel__option'
          onClick={() => onInteractionResponse?.(interactionRequest.id, option.value ?? option.label)}
        >
          <div className='interaction-panel__option-label'>{option.label}</div>
          {option.description && (
            <div className='interaction-panel__option-description'>
              {option.description}
            </div>
          )}
        </Button>
      ))}
    </div>
  )
}
