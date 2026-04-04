import './SenderToolbar.scss'

import { Button, Menu, Popover, Select, Tooltip } from 'antd'
import type { MenuProps, RefSelectProps } from 'antd'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ShortcutTooltip } from '#~/components/ShortcutTooltip'
import type { ChatEffort } from '#~/hooks/chat/use-chat-effort'
import type { ModelSelectMenuGroup, ModelSelectOption } from '#~/hooks/chat/use-chat-model-adapter-selection'
import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'
import { effortIconMap, permissionModeIconMap } from './sender-constants'
import type { ReferenceMenuKey, RovingFocusNavigation } from './sender-types'

const renderSelectArrow = (onMouseDown: (event: React.MouseEvent<HTMLSpanElement>) => void) => (
  <span className='material-symbols-rounded sender-select-arrow' onMouseDown={onMouseDown}>
    keyboard_arrow_down
  </span>
)

interface SenderToolbarShortcuts {
  switchModel: string
  switchEffort: string
  switchPermissionMode: string
}

export function SenderToolbar({
  state,
  data,
  refs,
  handlers
}: {
  state: {
    isInlineEdit: boolean
    isThinking: boolean
    modelUnavailable: boolean
    adapterLocked: boolean
    submitLoading: boolean
    supportsEffort: boolean
    canOpenReferenceActions: boolean
    showModelSelect: boolean
    showEffortSelect: boolean
    showReferenceActions: boolean
    showPermissionActions: boolean
    modelSearchValue: string
    selectedModel?: string
    effort: ChatEffort
    permissionMode: PermissionMode
    selectedAdapter?: string
    isMac: boolean
    resolvedSendShortcut: string
    hasComposerContent: boolean
    hasSendText: boolean
  }
  data: {
    modelMenuGroups?: ModelSelectMenuGroup[]
    modelSearchOptions?: ModelSelectOption[]
    recommendedModelOptions?: ModelSelectOption[]
    effortOptions: Array<{ value: ChatEffort; label: React.ReactNode }>
    permissionModeOptions: Array<{ value: PermissionMode; label: React.ReactNode }>
    adapterOptions?: Array<{ value: string; label: React.ReactNode }>
    composerControlShortcuts: SenderToolbarShortcuts
    submitLabel?: string
  }
  refs: {
    fileInputRef: React.RefObject<HTMLInputElement>
    modelSelectRef: React.RefObject<RefSelectProps>
    effortSelectRef: React.RefObject<RefSelectProps>
    referenceMenuNavigation: RovingFocusNavigation<ReferenceMenuKey>
    permissionMenuNavigation: RovingFocusNavigation<PermissionMode>
  }
  handlers: {
    onImageFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
    onReferenceOpenChange: (nextOpen: boolean) => void
    onShowModelSelectChange: (nextOpen: boolean) => void
    onShowEffortSelectChange: (nextOpen: boolean) => void
    onShowPermissionActionsChange: (nextOpen: boolean) => void
    onModelSearchValueChange: (value: string) => void
    onOpenContextPicker: () => void
    onReferenceImageSelect: () => void
    onSelectPermissionMode: (mode: PermissionMode) => void
    onReferenceMenuKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, key: ReferenceMenuKey) => void
    onPermissionMenuKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, key: PermissionMode) => void
    onOpenModelSelector: () => void
    onOpenEffortSelector: () => void
    onQueueTextareaFocusRestore: () => void
    onCloseReferenceActions: () => void
    onModelChange?: (model: string) => void
    onEffortChange?: (effort: ChatEffort) => void
    onAdapterChange?: (adapter: string) => void
    onSend: () => void
    onInterrupt: () => void
    onCancel?: () => void
  }
}) {
  const { t } = useTranslation()
  const {
    isInlineEdit,
    isThinking,
    modelUnavailable,
    adapterLocked,
    submitLoading,
    supportsEffort,
    canOpenReferenceActions,
    showModelSelect,
    showEffortSelect,
    showReferenceActions,
    showPermissionActions,
    modelSearchValue,
    selectedModel,
    effort,
    permissionMode,
    selectedAdapter,
    isMac,
    resolvedSendShortcut,
    hasComposerContent,
    hasSendText
  } = state
  const {
    modelMenuGroups,
    modelSearchOptions,
    recommendedModelOptions,
    effortOptions,
    permissionModeOptions,
    adapterOptions,
    composerControlShortcuts,
    submitLabel
  } = data
  const {
    fileInputRef,
    modelSelectRef,
    effortSelectRef,
    referenceMenuNavigation,
    permissionMenuNavigation
  } = refs
  const {
    onImageFileChange,
    onReferenceOpenChange,
    onShowModelSelectChange,
    onShowEffortSelectChange,
    onShowPermissionActionsChange,
    onModelSearchValueChange,
    onOpenContextPicker,
    onReferenceImageSelect,
    onSelectPermissionMode,
    onReferenceMenuKeyDown,
    onPermissionMenuKeyDown,
    onOpenModelSelector,
    onOpenEffortSelector,
    onQueueTextareaFocusRestore,
    onCloseReferenceActions,
    onModelChange,
    onEffortChange,
    onAdapterChange,
    onSend,
    onInterrupt,
    onCancel
  } = handlers

  const hasModelSearchQuery = modelSearchValue.trim() !== ''
  const selectedPermissionOption = permissionModeOptions.find(option => option.value === permissionMode)
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

  const handleModelSelection = (value: string) => {
    onModelChange?.(value)
    onShowModelSelectChange(false)
    onModelSearchValueChange('')
    onQueueTextareaFocusRestore()
  }

  const handleModelMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
    domEvent.preventDefault()
    if (typeof key !== 'string' || key === 'more-models') {
      return
    }
    handleModelSelection(key)
  }

  const renderModelMenuTooltip = useCallback((description?: string) => {
    if (!description) {
      return null
    }

    return (
      <span className='model-menu-tooltip-content'>
        {description}
      </span>
    )
  }, [])

  const renderCompactModelMenuLabel = useCallback((option: ModelSelectOption) => {
    const label = (
      <span className='model-select-menu-item-label'>
        <span className='model-select-menu-item-title'>{option.displayLabel}</span>
      </span>
    )

    if (!option.description) {
      return label
    }

    return (
      <Tooltip
        title={renderModelMenuTooltip(option.description)}
        placement='left'
        classNames={{ root: 'model-menu-tooltip' }}
        mouseEnterDelay={.35}
        destroyOnHidden
      >
        {label}
      </Tooltip>
    )
  }, [renderModelMenuTooltip])

  const renderModelMenuGroupLabel = useCallback((group: ModelSelectMenuGroup) => {
    const label = (
      <span className='model-menu-group-label'>
        <span className='model-menu-group-title'>{group.title}</span>
      </span>
    )

    if (!group.description) {
      return label
    }

    return (
      <Tooltip
        title={renderModelMenuTooltip(group.description)}
        placement='left'
        classNames={{ root: 'model-menu-tooltip' }}
        mouseEnterDelay={.35}
        destroyOnHidden
      >
        {label}
      </Tooltip>
    )
  }, [renderModelMenuTooltip])

  const modelMenuItems = useMemo<MenuProps['items']>(() => {
    const recommendedItems = (recommendedModelOptions ?? []).map(option => ({
      key: option.value,
      label: renderCompactModelMenuLabel(option),
      className: 'model-select-menu-item'
    }))

    const moreModelChildren = (modelMenuGroups ?? [])
      .filter(group => group.options.length > 0)
      .map(group => ({
        key: group.key,
        label: renderModelMenuGroupLabel(group),
        popupClassName: 'model-select-submenu-popup',
        children: group.options.map(option => ({
          key: option.value,
          label: renderCompactModelMenuLabel(option),
          className: 'model-select-menu-item'
        }))
      }))

    if (moreModelChildren.length === 0) {
      return recommendedItems
    }

    return [
      ...recommendedItems,
      {
        key: 'more-models',
        label: <span className='model-more-menu-label'>{t('chat.modelMoreModels')}</span>,
        popupClassName: 'model-select-submenu-popup',
        children: moreModelChildren
      }
    ]
  }, [modelMenuGroups, recommendedModelOptions, renderCompactModelMenuLabel, renderModelMenuGroupLabel, t])

  const renderModelPopup = (menu: React.ReactElement) => {
    if (hasModelSearchQuery || modelMenuItems == null || modelMenuItems.length === 0) {
      return menu
    }

    return (
      <div
        className='model-select-browser'
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <Menu
          className='model-select-menu'
          mode='vertical'
          selectable
          selectedKeys={selectedModel ? [selectedModel] : []}
          triggerSubMenuAction='hover'
          items={modelMenuItems}
          onClick={handleModelMenuClick}
        />
      </div>
    )
  }

  const toggleModelSelectorFromArrow = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (showModelSelect) {
      onShowModelSelectChange(false)
      onQueueTextareaFocusRestore()
      return
    }

    onOpenModelSelector()
  }

  const toggleEffortSelectorFromArrow = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (showEffortSelect) {
      onShowEffortSelectChange(false)
      onQueueTextareaFocusRestore()
      return
    }

    onOpenEffortSelector()
  }

  const handleModelBodyTriggerMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onOpenModelSelector()
  }

  const handleEffortBodyTriggerMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onOpenEffortSelector()
  }

  return (
    <div className='chat-input-toolbar'>
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        multiple
        onChange={onImageFileChange}
        className='file-input-hidden'
      />
      <div className='toolbar-left'>
        <Popover
          content={
            <div className='reference-actions-menu'>
              <button
                ref={referenceMenuNavigation.registerItem('image')}
                type='button'
                className='reference-actions-menu-item'
                onMouseEnter={() => {
                  referenceMenuNavigation.setActiveKey('image')
                  onShowPermissionActionsChange(false)
                }}
                onFocus={() => referenceMenuNavigation.setActiveKey('image')}
                onKeyDown={(event) => onReferenceMenuKeyDown(event, 'image')}
                onClick={onReferenceImageSelect}
              >
                <span className='reference-action-option'>
                  <span className='material-symbols-rounded reference-action-option__icon'>image</span>
                  <span className='reference-action-option__label'>{t('chat.referenceImage')}</span>
                </span>
              </button>
              {!isInlineEdit && (
                <button
                  ref={referenceMenuNavigation.registerItem('file')}
                  type='button'
                  className='reference-actions-menu-item'
                  onMouseEnter={() => {
                    referenceMenuNavigation.setActiveKey('file')
                    onShowPermissionActionsChange(false)
                  }}
                  onFocus={() => referenceMenuNavigation.setActiveKey('file')}
                  onKeyDown={(event) => onReferenceMenuKeyDown(event, 'file')}
                  onClick={() => {
                    onCloseReferenceActions()
                    onOpenContextPicker()
                  }}
                >
                  <span className='reference-action-option'>
                    <span className='material-symbols-rounded reference-action-option__icon'>description</span>
                    <span className='reference-action-option__label'>{t('chat.referenceFile')}</span>
                  </span>
                </button>
              )}
              {!isInlineEdit && permissionModeOptions.length > 0 && (
                <Popover
                  content={
                    <div className='reference-actions-menu reference-actions-menu--submenu'>
                      {permissionModeOptions.map(option => (
                        <button
                          key={option.value}
                          ref={permissionMenuNavigation.registerItem(option.value)}
                          type='button'
                          className={`reference-actions-menu-item ${
                            permissionMode === option.value ? 'is-selected' : ''
                          }`.trim()}
                          onMouseEnter={() => permissionMenuNavigation.setActiveKey(option.value)}
                          onFocus={() => permissionMenuNavigation.setActiveKey(option.value)}
                          onKeyDown={(event) => onPermissionMenuKeyDown(event, option.value)}
                          onClick={() => {
                            onSelectPermissionMode(option.value)
                          }}
                        >
                          <span className='reference-action-option reference-action-option--permission'>
                            <span className='material-symbols-rounded reference-action-option__icon'>
                              {permissionModeIconMap[option.value]}
                            </span>
                            <span className='reference-action-option__label'>{option.label}</span>
                            {permissionMode === option.value && (
                              <span className='material-symbols-rounded reference-action-option__check'>
                                check
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  }
                  open={showReferenceActions ? showPermissionActions : false}
                  onOpenChange={(nextOpen) => {
                    if (!showReferenceActions) {
                      return
                    }
                    referenceMenuNavigation.setActiveKey('permission')
                    if (nextOpen) {
                      permissionMenuNavigation.setActiveKey(permissionMode)
                    }
                    onShowPermissionActionsChange(nextOpen)
                  }}
                  placement='rightTop'
                  trigger={['hover', 'click']}
                  classNames={{ root: 'reference-actions-submenu-popover' }}
                  destroyOnHidden
                  arrow={false}
                >
                  <button
                    ref={referenceMenuNavigation.registerItem('permission')}
                    type='button'
                    className='reference-actions-menu-item reference-actions-menu-item--submenu'
                    onMouseEnter={() => referenceMenuNavigation.setActiveKey('permission')}
                    onFocus={() => referenceMenuNavigation.setActiveKey('permission')}
                    onKeyDown={(event) => onReferenceMenuKeyDown(event, 'permission')}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onShowPermissionActionsChange(!showPermissionActions)
                    }}
                  >
                    <span className='reference-action-option'>
                      <span className='material-symbols-rounded reference-action-option__icon'>lock</span>
                      <span className='reference-action-option__label'>{t('chat.referencePermission')}</span>
                      <span className='reference-action-option__value'>{selectedPermissionOption?.label}</span>
                      <span className='material-symbols-rounded reference-action-option__chevron'>
                        chevron_right
                      </span>
                    </span>
                  </button>
                </Popover>
              )}
            </div>
          }
          open={showReferenceActions}
          onOpenChange={onReferenceOpenChange}
          placement='topLeft'
          trigger='click'
          classNames={{ root: 'reference-actions-popover' }}
          destroyOnHidden
          arrow={false}
        >
          <ShortcutTooltip
            shortcut={composerControlShortcuts.switchPermissionMode}
            isMac={isMac}
            title={t('chat.referenceActionsShortcutTooltip')}
            enabled={!showReferenceActions}
          >
            <div
              className={`toolbar-btn toolbar-btn--reference ${showReferenceActions ? 'active' : ''}`.trim()}
              tabIndex={-1}
              onClick={canOpenReferenceActions ? undefined : (event) => {
                event.preventDefault()
                void onReferenceOpenChange(true)
              }}
            >
              <span className='toolbar-btn__icon-shell'>
                <span className='material-symbols-rounded'>add</span>
              </span>
              <span className='toolbar-btn__text'>{t('chat.referenceActionsShort')}</span>
            </div>
          </ShortcutTooltip>
        </Popover>

        {!isInlineEdit && (
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
                  onMouseDown={handleModelBodyTriggerMouseDown}
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
                suffixIcon={renderSelectArrow(toggleModelSelectorFromArrow)}
              />
            </div>
          </ShortcutTooltip>
        )}

        {!isInlineEdit && supportsEffort && (
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
                  onMouseDown={handleEffortBodyTriggerMouseDown}
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
                suffixIcon={renderSelectArrow(toggleEffortSelectorFromArrow)}
              />
            </div>
          </ShortcutTooltip>
        )}
      </div>

      <div className={`toolbar-right ${isInlineEdit ? 'toolbar-right--inline-edit' : ''}`.trim()}>
        {!isInlineEdit && adapterOptions && adapterOptions.length > 1 && (
          <Tooltip title={adapterLocked ? t('chat.adapterLockedTooltip') : undefined} placement='top'>
            <span className='adapter-select-tooltip-target'>
              <Select
                className={`adapter-select ${adapterLocked ? 'adapter-select--locked' : ''}`.trim()}
                classNames={{ popup: { root: 'adapter-select-popup' } }}
                value={selectedAdapter}
                options={adapterOptions}
                showSearch={false}
                allowClear={false}
                disabled={adapterLocked || modelUnavailable || isThinking}
                onChange={(value) => onAdapterChange?.(value)}
                placeholder={t('chat.adapterSelectPlaceholder', { defaultValue: 'Adapter' })}
                optionLabelProp='label'
                popupMatchSelectWidth={false}
                suffixIcon={null}
              />
            </span>
          </Tooltip>
        )}

        {isInlineEdit
          ? (
            <>
              {onCancel != null && (
                <Button autoInsertSpace={false} size='small' disabled={submitLoading} onClick={onCancel}>
                  {t('common.cancel')}
                </Button>
              )}
              <Button
                autoInsertSpace={false}
                type='primary'
                size='small'
                loading={submitLoading}
                disabled={!hasComposerContent}
                onClick={onSend}
              >
                {submitLabel ?? t('chat.send')}
              </Button>
            </>
          )
          : (
            <ShortcutTooltip
              shortcut={resolvedSendShortcut}
              isMac={isMac}
              title={t('chat.sendShortcutTooltip')}
              targetClassName='sender-control-tooltip-target'
              enabled={!isThinking}
            >
              <div
                className={`chat-send-btn ${hasSendText && !modelUnavailable ? 'active' : ''} ${
                  isThinking ? 'thinking' : ''
                } ${modelUnavailable ? 'disabled' : ''}`.trim()}
                onClick={modelUnavailable ? undefined : (isThinking ? onInterrupt : onSend)}
              >
                <span className='material-symbols-rounded'>
                  {isThinking ? 'stop_circle' : 'send'}
                </span>
              </div>
            </ShortcutTooltip>
          )}
      </div>
    </div>
  )
}
