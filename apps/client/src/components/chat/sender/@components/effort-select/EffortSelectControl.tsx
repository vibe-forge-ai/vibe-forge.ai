import '../sender-toolbar/SenderSelectShared.scss'
import '../sender-toolbar/SenderSelectBase.scss'
import './EffortSelectControl.scss'
import './EffortSelectDropdown.scss'

import { Select } from 'antd'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ShortcutTooltip } from '#~/components/ShortcutTooltip'
import { effortIconMap } from '../../@utils/sender-constants'
import type {
  SenderToolbarData,
  SenderToolbarHandlers,
  SenderToolbarRefs,
  SenderToolbarState
} from '../../@types/sender-toolbar-types'

const renderSelectArrow = (onMouseDown: (event: React.MouseEvent<HTMLSpanElement>) => void) => (
  <span className='material-symbols-rounded sender-select-arrow' onMouseDown={onMouseDown}>
    keyboard_arrow_down
  </span>
)

export function EffortSelectControl({
  state,
  data,
  refs,
  handlers
}: {
  state: Pick<
    SenderToolbarState,
    'isThinking' | 'modelUnavailable' | 'showModelSelect' | 'showEffortSelect' | 'effort' | 'isMac'
  >
  data: Pick<SenderToolbarData, 'effortOptions' | 'composerControlShortcuts'>
  refs: Pick<SenderToolbarRefs, 'effortSelectRef'>
  handlers: Pick<
    SenderToolbarHandlers,
    | 'onShowModelSelectChange'
    | 'onShowEffortSelectChange'
    | 'onOpenEffortSelector'
    | 'onQueueTextareaFocusRestore'
    | 'onCloseReferenceActions'
    | 'onEffortChange'
  >
}) {
  const { t } = useTranslation()
  const { isThinking, modelUnavailable, showEffortSelect, effort, isMac } = state
  const { effortOptions, composerControlShortcuts } = data
  const { effortSelectRef } = refs
  const {
    onShowModelSelectChange,
    onShowEffortSelectChange,
    onOpenEffortSelector,
    onQueueTextareaFocusRestore,
    onCloseReferenceActions,
    onEffortChange
  } = handlers

  const decoratedEffortOptions = useMemo(() => {
    return effortOptions.map(option => ({
      ...option,
      label: (
        <span className={`effort-option effort-option--${option.value}`.trim()}>
          <span className='material-symbols-rounded effort-option__icon'>{effortIconMap[option.value]}</span>
          <span className='effort-option__text'>
            {option.value === 'default' ? t('chat.effortLabels.default') : t(`chat.effortLabels.${option.value}`)}
          </span>
        </span>
      )
    }))
  }, [effortOptions, t])

  return (
    <ShortcutTooltip
      shortcut={composerControlShortcuts.switchEffort}
      isMac={isMac}
      title={t('chat.effortShortcutTooltip')}
      targetClassName='sender-control-tooltip-target'
      enabled={!showEffortSelect}
    >
      <div className='sender-select-shell'>
        {!showEffortSelect && !(modelUnavailable || isThinking) && (
          <button
            type='button'
            className='sender-select-body-trigger'
            aria-label={t('chat.effortShortcutTooltip')}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenEffortSelector()
            }}
          />
        )}
        <Select
          ref={effortSelectRef}
          className='effort-select'
          classNames={{ popup: { root: 'effort-select-popup' } }}
          open={showEffortSelect}
          value={effort}
          options={decoratedEffortOptions}
          showSearch={false}
          allowClear={false}
          disabled={modelUnavailable || isThinking}
          onChange={(value) => {
            onEffortChange?.(value)
            onShowEffortSelectChange(false)
            onQueueTextareaFocusRestore()
          }}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              onShowModelSelectChange(false)
              onCloseReferenceActions()
            } else {
              onQueueTextareaFocusRestore()
            }
            onShowEffortSelectChange(nextOpen)
          }}
          placeholder={t('chat.effortSelectPlaceholder')}
          optionLabelProp='label'
          popupMatchSelectWidth={false}
          suffixIcon={renderSelectArrow((event) => {
            event.preventDefault()
            event.stopPropagation()
            if (showEffortSelect) {
              onShowEffortSelectChange(false)
              onQueueTextareaFocusRestore()
              return
            }
            onOpenEffortSelector()
          })}
        />
      </div>
    </ShortcutTooltip>
  )
}
