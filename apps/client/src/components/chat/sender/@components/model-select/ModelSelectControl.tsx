import '../sender-toolbar/SenderSelectShared.scss'
import '../sender-toolbar/SenderSelectBase.scss'
import './ModelSelectControl.scss'
import './ModelSelectMenu.scss'
import './ModelSelectMenuLabels.scss'

import { Select } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { ShortcutTooltip } from '#~/components/ShortcutTooltip'
import { useModelSelectBrowser } from '#~/components/chat/sender/@hooks/use-model-select-browser'
import type { ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'

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

export function ModelSelectControl({
  state,
  data,
  refs,
  handlers
}: {
  state: Pick<
    SenderToolbarState,
    | 'isThinking'
    | 'modelUnavailable'
    | 'showModelSelect'
    | 'showEffortSelect'
    | 'selectedModel'
    | 'modelSearchValue'
    | 'isMac'
  >
  data: Pick<
    SenderToolbarData,
    'modelMenuGroups' | 'modelSearchOptions' | 'recommendedModelOptions' | 'composerControlShortcuts'
  >
  refs: Pick<SenderToolbarRefs, 'modelSelectRef'>
  handlers: Pick<
    SenderToolbarHandlers,
    | 'onShowModelSelectChange'
    | 'onShowEffortSelectChange'
    | 'onModelSearchValueChange'
    | 'onOpenModelSelector'
    | 'onQueueTextareaFocusRestore'
    | 'onCloseReferenceActions'
    | 'onModelChange'
  >
}) {
  const { t } = useTranslation()
  const { isThinking, modelUnavailable, showModelSelect, showEffortSelect, selectedModel, modelSearchValue, isMac } =
    state
  const { modelMenuGroups, modelSearchOptions, recommendedModelOptions, composerControlShortcuts } = data
  const { modelSelectRef } = refs
  const {
    onShowModelSelectChange,
    onShowEffortSelectChange,
    onModelSearchValueChange,
    onOpenModelSelector,
    onQueueTextareaFocusRestore,
    onCloseReferenceActions,
    onModelChange
  } = handlers

  const handleModelSelection = (value: string) => {
    onModelChange?.(value)
    onShowModelSelectChange(false)
    onModelSearchValueChange('')
    onQueueTextareaFocusRestore()
  }
  const { renderModelPopup } = useModelSelectBrowser({
    hasModelSearchQuery: modelSearchValue.trim() !== '',
    modelMenuGroups,
    recommendedModelOptions,
    selectedModel,
    onSelectModel: handleModelSelection
  })

  return (
    <ShortcutTooltip
      shortcut={composerControlShortcuts.switchModel}
      isMac={isMac}
      title={t('chat.modelShortcutTooltip')}
      targetClassName='sender-control-tooltip-target'
      enabled={!showModelSelect}
    >
      <div className='sender-select-shell'>
        {!showModelSelect && !(modelUnavailable || isThinking) && (
          <button
            type='button'
            className='sender-select-body-trigger'
            aria-label={t('chat.modelShortcutTooltip')}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenModelSelector()
            }}
          />
        )}
        <Select
          ref={modelSelectRef}
          className='model-select'
          classNames={{ popup: { root: 'model-select-popup' } }}
          open={showModelSelect}
          value={selectedModel}
          options={modelSearchOptions ?? []}
          showSearch
          searchValue={modelSearchValue}
          allowClear={false}
          disabled={modelUnavailable || isThinking}
          onChange={handleModelSelection}
          onOpenChange={(nextOpen) => {
            if (nextOpen) {
              onShowEffortSelectChange(false)
              onCloseReferenceActions()
            } else {
              onQueueTextareaFocusRestore()
            }
            onShowModelSelectChange(nextOpen)
          }}
          onSearch={onModelSearchValueChange}
          placeholder={modelUnavailable ? t('chat.modelUnavailable') : t('chat.modelSelectPlaceholder')}
          optionLabelProp='displayLabel'
          filterOption={(input, option) => {
            const searchText = String((option as ModelSelectOption | undefined)?.searchText ?? '')
            return searchText.toLowerCase().includes(input.toLowerCase())
          }}
          popupRender={renderModelPopup}
          popupMatchSelectWidth={false}
          suffixIcon={renderSelectArrow((event) => {
            event.preventDefault()
            event.stopPropagation()
            if (showModelSelect) {
              onShowModelSelectChange(false)
              onQueueTextareaFocusRestore()
              return
            }
            onOpenModelSelector()
          })}
        />
      </div>
    </ShortcutTooltip>
  )
}
