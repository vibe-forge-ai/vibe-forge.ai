/* eslint-disable max-lines -- account selector keeps control, menu actions, and connect flow together. */
import '../sender-toolbar/SenderSelectShared.scss'
import '../sender-toolbar/SenderSelectBase.scss'
import './AccountSelectControl.scss'
import './AccountSelectDropdown.scss'

import { App, Button, Modal, Select, Tooltip } from 'antd'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useSWRConfig } from 'swr'

import { getApiErrorMessage, manageAdapterAccount } from '#~/api'
import type { ChatAdapterAccountOption } from '#~/hooks/chat/use-chat-adapter-account-selection'
import { useResponsiveLayout } from '#~/hooks/use-responsive-layout'

import type { SenderToolbarData, SenderToolbarHandlers, SenderToolbarState } from '../../@types/sender-toolbar-types'

const renderSelectArrow = (onMouseDown: (event: ReactMouseEvent<HTMLSpanElement>) => void) => (
  <span className='material-symbols-rounded sender-select-arrow' onMouseDown={onMouseDown}>
    keyboard_arrow_down
  </span>
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
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { mutate } = useSWRConfig()
  const { isCompactLayout, isTouchInteraction } = useResponsiveLayout()
  const { isThinking, modelUnavailable, selectedAccount, selectedAdapter, showAccountSelector } = state
  const { accountOptions } = data
  const [showAccountSelect, setShowAccountSelect] = useState(false)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [cancelingCreateAccount, setCancelingCreateAccount] = useState(false)
  const createAccountAbortRef = useRef<AbortController | null>(null)
  const isCompactControl = isCompactLayout || isTouchInteraction

  const selectedOption = useMemo(
    () => accountOptions?.find(option => option.value === selectedAccount),
    [accountOptions, selectedAccount]
  )
  const isDisabled = modelUnavailable || isThinking

  if (!showAccountSelector || accountOptions == null || accountOptions.length === 0) {
    return null
  }

  const openAdapterConfig = () => {
    if (selectedAdapter == null || selectedAdapter.trim() === '') {
      return
    }

    setShowAccountSelect(false)
    void navigate(
      `/config?tab=adapters&source=user&detail=${encodeURIComponent(`${selectedAdapter}/accounts`)}`
    )
  }

  const createAccount = () => {
    if (selectedAdapter == null || selectedAdapter.trim() === '') {
      return
    }

    setShowAccountSelect(false)
    const abortController = new AbortController()
    createAccountAbortRef.current = abortController
    setCreatingAccount(true)
    setCancelingCreateAccount(false)

    void (async () => {
      try {
        const result = await manageAdapterAccount(
          selectedAdapter,
          { action: 'add' },
          { signal: abortController.signal }
        )

        await mutate((key) => (
          Array.isArray(key) &&
          key[0] === '/api/adapters' &&
          key[1] === selectedAdapter
        ))

        if (result.accountKey != null && result.accountKey.trim() !== '') {
          handlers.onAccountChange?.(result.accountKey)
        }

        void message.success(result.message ?? t('config.accounts.actionSuccess.add'))
      } catch (error) {
        if (abortController.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          void message.info(t('chat.accountSelectCreateCanceled'))
          return
        }

        void message.error(getApiErrorMessage(error, t('config.accounts.actionFailed.add')))
      } finally {
        if (createAccountAbortRef.current === abortController) {
          createAccountAbortRef.current = null
        }
        setCreatingAccount(false)
        setCancelingCreateAccount(false)
      }
    })()
  }

  const cancelCreateAccount = () => {
    const controller = createAccountAbortRef.current
    if (controller == null || controller.signal.aborted) {
      return
    }

    setCancelingCreateAccount(true)
    controller.abort()
  }

  const openAccountConfig = (accountKey: string) => {
    if (selectedAdapter == null || selectedAdapter.trim() === '') {
      return
    }

    setShowAccountSelect(false)
    void navigate(
      `/config?tab=adapters&source=user&detail=${encodeURIComponent(`${selectedAdapter}/accounts/${accountKey}`)}`
    )
  }

  const renderOption = (option: ChatAdapterAccountOption) => (
    <div className='account-option'>
      <div className='account-option__title-row'>
        <span className='account-option__title'>{option.label}</span>
        <div className='account-option__actions'>
          <Tooltip
            title={t('chat.accountSelectOpenAccountConfig', { account: option.label })}
            placement='left'
            arrow={false}
          >
            <button
              type='button'
              className='account-option__action'
              aria-label={t('chat.accountSelectOpenAccountConfig', { account: option.label })}
              onMouseDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                openAccountConfig(option.value)
              }}
            >
              <span className='material-symbols-rounded'>settings</span>
            </button>
          </Tooltip>
        </div>
      </div>
      {option.meta != null && option.meta !== '' && (
        <div className='account-option__meta'>{option.meta}</div>
      )}
    </div>
  )

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
            onClick={createAccount}
          >
            <span className='material-symbols-rounded'>person_add</span>
            <span>{t('chat.accountSelectCreateAccount', { adapter: selectedAdapter })}</span>
          </button>
          <button
            type='button'
            className='account-select-popup__footer-action'
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={openAdapterConfig}
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
      <Modal
        open={creatingAccount}
        centered
        maskClosable={false}
        keyboard={false}
        closable={false}
        title={t('chat.accountSelectCreateTitle', { adapter: selectedAdapter ?? 'adapter' })}
        footer={[
          <Button
            key='cancel'
            danger
            disabled={cancelingCreateAccount}
            onClick={cancelCreateAccount}
          >
            {cancelingCreateAccount ? t('chat.accountSelectCreateCanceling') : t('common.cancel')}
          </Button>
        ]}
      >
        <div className='account-select-create-modal'>
          <span className='material-symbols-rounded account-select-create-modal__icon'>
            pending_actions
          </span>
          <div className='account-select-create-modal__title'>
            {t('chat.accountSelectCreateWaiting')}
          </div>
          <div className='account-select-create-modal__description'>
            {t('chat.accountSelectCreateDescription', { adapter: selectedAdapter ?? 'adapter' })}
          </div>
        </div>
      </Modal>
    </div>
  )
}
