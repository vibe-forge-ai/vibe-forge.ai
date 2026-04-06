/* eslint-disable max-lines */
import './SenderInteractionPanel.scss'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

import { Button, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import type { AskUserQuestionParams } from '@vibe-forge/core'
import type { PermissionInteractionContext } from '@vibe-forge/types'

import { ChatComposerCard } from '#~/components/chat/ChatComposerCard'
import { getLoopedIndex } from '#~/hooks/use-roving-focus-list'

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

const getInteractionOptionKey = (
  option: { label: string; value?: string },
  idx: number
) => option.value ?? `${idx}:${option.label}`

export function SenderInteractionPanel({
  interactionRequest,
  activeOptionIndex,
  permissionContext,
  deniedTools,
  reasons: _reasons,
  onActiveOptionIndexChange,
  onMoveActiveOption,
  onInteractionResponse
}: {
  interactionRequest: { id: string; payload: AskUserQuestionParams }
  activeOptionIndex: number
  permissionContext?: PermissionInteractionContext
  deniedTools: string[]
  reasons: string[]
  onActiveOptionIndexChange: (index: number) => void
  onMoveActiveOption: (delta: number) => void
  onInteractionResponse?: (id: string, data: string | string[]) => void
}) {
  const { t } = useTranslation()
  const [showAllPermissionOptions, setShowAllPermissionOptions] = useState(false)
  const isPermissionInteraction = permissionContext != null
  const options = interactionRequest.payload.options ?? []
  const optionsContainerRef = useRef<HTMLDivElement | null>(null)
  const normalizedActiveOptionIndex = options.length === 0
    ? -1
    : Math.min(Math.max(activeOptionIndex, 0), options.length - 1)

  const optionItems = useMemo(() =>
    options.map((option, index) => ({
      option,
      index,
      meta: getOptionMeta(option.value)
    })), [options])
  const primaryPermissionOptionItems = useMemo(
    () => optionItems.filter(({ option }) => primaryOptionValues.has(option.value ?? '')),
    [optionItems]
  )
  const secondaryPermissionOptionItems = useMemo(
    () => optionItems.filter(({ option }) => !primaryOptionValues.has(option.value ?? '')),
    [optionItems]
  )
  const activePermissionOptionIsSecondary = isPermissionInteraction &&
    secondaryPermissionOptionItems.some(({ index }) => index === normalizedActiveOptionIndex)
  const visibleOptionItems = isPermissionInteraction
    ? ((showAllPermissionOptions || activePermissionOptionIsSecondary) ? optionItems : primaryPermissionOptionItems)
    : optionItems

  const toolNames = [
    permissionContext?.subjectLabel?.trim() ?? '',
    ...deniedTools.map(tool => tool.trim())
  ].filter((value, index, values) => value !== '' && values.indexOf(value) === index)
  const toolSummary = toolNames.join('、')
  const title = isPermissionInteraction && toolSummary !== ''
    ? t('chat.permissionRequestTitleWithTool', { tool: toolSummary })
    : interactionRequest.payload.question

  const focusOptionAtIndex = (index: number, attempt = 0) => {
    const option = optionsContainerRef.current?.querySelector<HTMLButtonElement>(
      `.interaction-panel__option[data-option-index="${index}"]`
    )

    if (option != null) {
      option.focus()
      return
    }

    if (attempt >= 5) {
      return
    }

    window.setTimeout(() => {
      focusOptionAtIndex(index, attempt + 1)
    }, 40)
  }

  useEffect(() => {
    setShowAllPermissionOptions(false)
  }, [interactionRequest.id])

  useEffect(() => {
    if (activePermissionOptionIsSecondary) {
      setShowAllPermissionOptions(true)
    }
  }, [activePermissionOptionIsSecondary])

  useEffect(() => {
    if (!isPermissionInteraction || options.length === 0) {
      return
    }
    let cancelled = false
    const targetIndex = normalizedActiveOptionIndex >= 0 ? normalizedActiveOptionIndex : 0

    const focusWhenReady = (attempt = 0) => {
      if (cancelled) {
        return
      }

      const option = optionsContainerRef.current?.querySelector<HTMLButtonElement>(
        `.interaction-panel__option[data-option-index="${targetIndex}"]`
      )

      if (option != null) {
        option.focus()
        return
      }

      if (attempt >= 5) {
        return
      }

      window.setTimeout(() => {
        focusWhenReady(attempt + 1)
      }, 40)
    }

    focusWhenReady()

    return () => {
      cancelled = true
    }
  }, [
    interactionRequest.id,
    isPermissionInteraction,
    normalizedActiveOptionIndex,
    options.length,
    showAllPermissionOptions
  ])

  const handleSubmitOption = (option: { label: string; value?: string }) => {
    onInteractionResponse?.(interactionRequest.id, option.value ?? option.label)
  }

  const moveOptionFocus = (delta: number, focus = isPermissionInteraction) => {
    if (options.length === 0) {
      return
    }

    const sourceIndex = normalizedActiveOptionIndex >= 0 ? normalizedActiveOptionIndex : 0
    const nextIndex = getLoopedIndex(sourceIndex, delta, options.length)
    onMoveActiveOption(delta)
    if (focus) {
      focusOptionAtIndex(nextIndex)
    }
  }

  const handleNavButtonKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
    delta: number
  ) => {
    if ((event.key === 'ArrowUp' && delta < 0) || (event.key === 'ArrowDown' && delta > 0)) {
      event.preventDefault()
      moveOptionFocus(delta)
    }
  }

  const handleOptionKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
    optionIndex: number
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      onActiveOptionIndexChange(getLoopedIndex(optionIndex, 1, options.length))
      focusOptionAtIndex(getLoopedIndex(optionIndex, 1, options.length))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      onActiveOptionIndexChange(getLoopedIndex(optionIndex, -1, options.length))
      focusOptionAtIndex(getLoopedIndex(optionIndex, -1, options.length))
    }
  }

  const handleTogglePermissionOptions = () => {
    setShowAllPermissionOptions((current) => {
      const next = !current

      if (!next && activePermissionOptionIsSecondary) {
        const fallbackIndex = primaryPermissionOptionItems.at(-1)?.index ?? 0
        onActiveOptionIndexChange(fallbackIndex)
      }

      return next
    })
  }

  const showOptionControls = options.length > 1

  return (
    <ChatComposerCard
      className={[
        'interaction-panel',
        isPermissionInteraction ? 'interaction-panel--permission' : 'interaction-panel--question'
      ].filter(Boolean).join(' ')}
      summaryClassName='interaction-panel__summary'
      bodyClassName='interaction-panel__body'
      narrow
      summary={
        <div className='interaction-panel__header'>
          <div className='interaction-panel__title-wrap'>
            {!isPermissionInteraction && (
              <span className='material-symbols-rounded interaction-panel__title-icon'>
                help
              </span>
            )}
            <div className='interaction-question'>{title}</div>
          </div>
          {showOptionControls && (
            <div className='interaction-panel__nav' aria-label={t('chat.interactionOptionNavigation')}>
              <Tooltip title={t('chat.interactionOptionPrevious')} placement='top' destroyOnHidden>
                <button
                  type='button'
                  className='interaction-panel__nav-button'
                  aria-label={t('chat.interactionOptionPrevious')}
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                  onKeyDown={(event) => handleNavButtonKeyDown(event, -1)}
                  onClick={() => moveOptionFocus(-1)}
                >
                  <span className='material-symbols-rounded'>keyboard_arrow_up</span>
                </button>
              </Tooltip>
              <Tooltip title={t('chat.interactionOptionNext')} placement='top' destroyOnHidden>
                <button
                  type='button'
                  className='interaction-panel__nav-button'
                  aria-label={t('chat.interactionOptionNext')}
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                  onKeyDown={(event) => handleNavButtonKeyDown(event, 1)}
                  onClick={() => moveOptionFocus(1)}
                >
                  <span className='material-symbols-rounded'>keyboard_arrow_down</span>
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      }
    >
      <div ref={optionsContainerRef} className='interaction-panel__options'>
        {visibleOptionItems.map(({ option, index, meta }) => {
          const optionKey = getInteractionOptionKey(option, index)
          const isActive = index === normalizedActiveOptionIndex

          if (isPermissionInteraction) {
            return (
              <Button
                key={optionKey}
                block
                data-option-index={index}
                tabIndex={isActive ? 0 : -1}
                className={[
                  'interaction-panel__option',
                  `interaction-panel__option--${meta.tone}`,
                  isActive ? 'is-active' : ''
                ].filter(Boolean).join(' ')}
                onFocus={() => onActiveOptionIndexChange(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onClick={() => handleSubmitOption(option)}
              >
                <span className='interaction-panel__option-icon material-symbols-rounded'>{meta.icon}</span>
                <span className='interaction-panel__option-copy'>
                  <span className='interaction-panel__option-text'>
                    <span className='interaction-panel__option-label'>{option.label}</span>
                    {option.description && (
                      <span className='interaction-panel__option-description'>
                        {option.description}
                      </span>
                    )}
                  </span>
                </span>
              </Button>
            )
          }

          return (
            <Button
              key={optionKey}
              block
              data-option-index={index}
              tabIndex={isActive ? 0 : -1}
              className={`interaction-panel__option interaction-panel__option--question ${isActive ? 'is-active' : ''}`
                .trim()}
              onFocus={() => onActiveOptionIndexChange(index)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              onClick={() => handleSubmitOption(option)}
            >
              <span className='interaction-panel__option-main'>
                <span className='interaction-panel__option-index' aria-hidden='true'>
                  {index + 1}.
                </span>
                <span className='interaction-panel__option-label'>{option.label}</span>
                {option.description && (
                  <span className='interaction-panel__option-side'>
                    {renderInfoButton(option.description)}
                  </span>
                )}
              </span>
            </Button>
          )
        })}
        {isPermissionInteraction && secondaryPermissionOptionItems.length > 0 && (
          <Button
            type='text'
            className='interaction-panel__toggle'
            onClick={handleTogglePermissionOptions}
          >
            <span className='interaction-panel__toggle-label'>
              {showAllPermissionOptions ? t('chat.permissionCollapseOptions') : t('chat.permissionExpandOptions')}
            </span>
            <span className='interaction-panel__toggle-icon material-symbols-rounded'>
              {showAllPermissionOptions ? 'expand_less' : 'expand_more'}
            </span>
          </Button>
        )}
      </div>
    </ChatComposerCard>
  )
}
