import '../sender-toolbar/SenderSelectShared.scss'
import '../sender-toolbar/SenderSelectBase.scss'
import './AccountSelectControl.scss'
import './AccountSelectDropdown.scss'

import { Select, Tooltip } from 'antd'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import type { ChatAdapterAccountOption } from '#~/hooks/chat/use-chat-adapter-account-selection'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'

import type { SenderToolbarData, SenderToolbarHandlers, SenderToolbarState } from '../../@types/sender-toolbar-types'

const renderSelectArrow = (onMouseDown: (event: ReactMouseEvent<HTMLSpanElement>) => void) => (
  <span className='material-symbols-rounded sender-select-arrow' onMouseDown={onMouseDown}>
    keyboard_arrow_down
  </span>
)

const renderOption = (option: ChatAdapterAccountOption) => (
  <div className='account-option'>
    <div className='account-option__title-row'>
      <span className='account-option__title'>{option.label}</span>
      {option.hint != null && option.hint !== '' && (
        <Tooltip title={option.hint} placement='left' arrow={false}>
          <button
            type='button'
            className='account-option__info'
            aria-label={option.hint}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <span className='material-symbols-rounded'>info</span>
          </button>
        </Tooltip>
      )}
    </div>
    {option.meta != null && option.meta !== '' && (
      <div className='account-option__meta'>{option.meta}</div>
    )}
  </div>
)

export function AccountSelectControl({
  state,
  data,
  handlers
}: {
  state: Pick<
    SenderToolbarState,
    'isThinking' | 'modelUnavailable' | 'selectedAccount' | 'selectedAdapter' | 'showAccountSelector'
  >
  data: Pick<SenderToolbarData, 'accountOptions'>
  handlers: Pick<SenderToolbarHandlers, 'onAccountChange'>
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isCompactLayout, isTouchInteraction } = useResponsiveLayout()
  const { isThinking, modelUnavailable, selectedAccount, selectedAdapter, showAccountSelector } = state
  const { accountOptions } = data
  const [showAccountSelect, setShowAccountSelect] = useState(false)
  const isCompactControl = isCompactLayout || isTouchInteraction

  const selectedOption = useMemo(
    () => accountOptions?.find(option => option.value === selectedAccount),
    [accountOptions, selectedAccount]
  )
  const isDisabled = modelUnavailable || isThinking

  if (!showAccountSelector || accountOptions == null || accountOptions.length === 0) {
    return null
  }

  const renderPopup = (originNode: ReactNode) => (
    <>
      {originNode}
      {selectedAdapter != null && selectedAdapter.trim() !== '' && (
        <div className='account-select-popup__footer'>
          <button
            type='button'
            className='account-select-popup__footer-action'
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={() => {
              setShowAccountSelect(false)
              void navigate(`/config?tab=adapters&source=user&detail=${encodeURIComponent(selectedAdapter)}`)
            }}
          >
            <span className='material-symbols-rounded'>settings</span>
            <span>{t('chat.accountSelectOpenAdapterConfig', { adapter: selectedAdapter })}</span>
          </button>
        </div>
      )}
    </>
  )

  return (
    <div className={`sender-select-shell ${isCompactControl ? 'sender-select-shell--compact' : ''}`.trim()}>
      {!showAccountSelect && !isDisabled && (
        <button
          type='button'
          className='sender-select-body-trigger'
          aria-label={selectedOption?.label ?? t('chat.accountSelectPlaceholder')}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setShowAccountSelect(true)
          }}
        />
      )}
      <Select
        className={`account-select ${isCompactControl ? 'account-select--compact' : ''}`.trim()}
        classNames={{ popup: { root: 'account-select-popup' } }}
        open={showAccountSelect}
        value={selectedAccount}
        options={accountOptions}
        disabled={isDisabled}
        onChange={(value) => {
          handlers.onAccountChange?.(value)
          setShowAccountSelect(false)
        }}
        onOpenChange={setShowAccountSelect}
        optionRender={(option) => renderOption(option.data as ChatAdapterAccountOption)}
        optionLabelProp='label'
        placeholder={t('chat.accountSelectPlaceholder')}
        popupMatchSelectWidth={false}
        popupRender={renderPopup}
        suffixIcon={isCompactControl
          ? null
          : renderSelectArrow((event) => {
            event.preventDefault()
            event.stopPropagation()
            setShowAccountSelect(prev => !prev)
          })}
      />
    </div>
  )
}
