import './SenderInteractionPanel.scss'

import { useEffect, useState } from 'react'
import { Button } from 'antd'
import { useTranslation } from 'react-i18next'

import type { AskUserQuestionParams } from '@vibe-forge/core'
import type { PermissionInteractionContext } from '@vibe-forge/types'

const primaryOptionValues = new Set(['allow_once', 'allow_session', 'deny_once'])

const getOptionMeta = (value?: string) => {
  switch (value) {
    case 'allow_once':
      return { icon: 'task_alt', tone: 'allow' as const }
    case 'allow_session':
      return { icon: 'history_toggle_off', tone: 'allow' as const }
    case 'allow_project':
      return { icon: 'folder_managed', tone: 'allow' as const }
    case 'deny_once':
      return { icon: 'cancel', tone: 'deny' as const }
    case 'deny_session':
      return { icon: 'block', tone: 'deny' as const }
    case 'deny_project':
      return { icon: 'folder_off', tone: 'deny' as const }
    default:
      return { icon: 'help', tone: 'neutral' as const }
  }
}

export function SenderInteractionPanel({
  interactionRequest,
  permissionContext,
  deniedTools,
  reasons: _reasons,
  onInteractionResponse
}: {
  interactionRequest: { id: string; payload: AskUserQuestionParams }
  permissionContext?: PermissionInteractionContext
  deniedTools: string[]
  reasons: string[]
  onInteractionResponse?: (id: string, data: string | string[]) => void
}) {
  const { t } = useTranslation()
  const [showAllOptions, setShowAllOptions] = useState(false)

  const toolNames = [
    permissionContext?.subjectLabel?.trim() ?? '',
    ...deniedTools.map(tool => tool.trim())
  ].filter((value, index, values) => value !== '' && values.indexOf(value) === index)
  const toolSummary = toolNames.join('、')
  const title = toolSummary === ''
    ? interactionRequest.payload.question
    : t('chat.permissionRequestTitleWithTool', { tool: toolSummary })
  const primaryOptions = interactionRequest.payload.options?.filter(option => primaryOptionValues.has(option.value ?? '')) ?? []
  const secondaryOptions = interactionRequest.payload.options?.filter(option => !primaryOptionValues.has(option.value ?? '')) ?? []

  useEffect(() => {
    setShowAllOptions(false)
  }, [interactionRequest.id])

  return (
    <div className='interaction-panel'>
      <div className='interaction-panel__header'>
        <div className='interaction-question'>
          {title}
        </div>
      </div>
      <div className='interaction-panel__options'>
        {primaryOptions.map((option: { label: string; value?: string; description?: string }) => {
          const meta = getOptionMeta(option.value)

          return (
            <Button
              key={option.value ?? option.label}
              className={[
                'interaction-panel__option',
                `interaction-panel__option--${meta.tone}`
              ].join(' ')}
              onClick={() => onInteractionResponse?.(interactionRequest.id, option.value ?? option.label)}
            >
              <span className='interaction-panel__option-icon material-symbols-rounded'>{meta.icon}</span>
              <div className='interaction-panel__option-copy'>
                <div className='interaction-panel__option-text'>
                  <div className='interaction-panel__option-label'>{option.label}</div>
                  {option.description && (
                    <div className='interaction-panel__option-description'>
                      {option.description}
                    </div>
                  )}
                </div>
              </div>
            </Button>
          )
        })}
        {showAllOptions && secondaryOptions.length > 0 && (
          <div className='interaction-panel__secondary'>
            {secondaryOptions.map((option: { label: string; value?: string; description?: string }) => {
              const meta = getOptionMeta(option.value)

              return (
                <Button
                  key={option.value ?? option.label}
                  className={[
                    'interaction-panel__option',
                    `interaction-panel__option--${meta.tone}`
                  ].join(' ')}
                  onClick={() => onInteractionResponse?.(interactionRequest.id, option.value ?? option.label)}
                >
                  <span className='interaction-panel__option-icon material-symbols-rounded'>{meta.icon}</span>
                  <div className='interaction-panel__option-copy'>
                    <div className='interaction-panel__option-text'>
                      <div className='interaction-panel__option-label'>{option.label}</div>
                      {option.description && (
                        <div className='interaction-panel__option-description'>
                          {option.description}
                        </div>
                      )}
                    </div>
                  </div>
                </Button>
              )
            })}
          </div>
        )}
        {secondaryOptions.length > 0 && (
          <Button
            type='text'
            className='interaction-panel__toggle'
            onClick={() => setShowAllOptions(current => !current)}
          >
            <span className='interaction-panel__toggle-label'>
              {showAllOptions ? t('chat.permissionCollapseOptions') : t('chat.permissionExpandOptions')}
            </span>
            <span className='interaction-panel__toggle-icon material-symbols-rounded'>
              {showAllOptions ? 'expand_less' : 'expand_more'}
            </span>
          </Button>
        )}
      </div>
    </div>
  )
}
