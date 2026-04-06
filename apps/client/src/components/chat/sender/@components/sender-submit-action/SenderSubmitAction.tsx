import '../sender-toolbar/SenderSelectShared.scss'
import './SenderSubmitAction.scss'

import { Button, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import { ShortcutDisplay } from '#~/components/ShortcutDisplay'
import { ShortcutTooltip } from '#~/components/ShortcutTooltip'

export function SenderSubmitAction({
  isInlineEdit,
  submitLoading,
  submitLabel,
  hasComposerContent,
  modelUnavailable,
  isThinking,
  resolvedSendShortcut,
  queueSteerShortcut,
  queueNextShortcut,
  isMac,
  onCancel,
  onSend,
  onStop
}: {
  isInlineEdit: boolean
  submitLoading: boolean
  submitLabel?: string
  hasComposerContent: boolean
  modelUnavailable: boolean
  isThinking: boolean
  resolvedSendShortcut: string
  queueSteerShortcut?: string
  queueNextShortcut?: string
  isMac: boolean
  onCancel?: () => void
  onSend: () => void
  onStop?: () => void
}) {
  const { t } = useTranslation()
  const showStopAction = isThinking && !hasComposerContent
  const isSendDisabled = !showStopAction && modelUnavailable
  const buttonClasses = [
    'chat-send-btn',
    hasComposerContent && !isSendDisabled ? 'active' : '',
    showStopAction ? 'stop' : '',
    isSendDisabled ? 'disabled' : ''
  ].filter(Boolean).join(' ')

  if (isInlineEdit) {
    return (
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
  }

  if (isThinking) {
    if (showStopAction) {
      return (
        <Tooltip
          title={
            <div className='sender-send-tooltip'>
              <div className='sender-send-tooltip__row'>
                <span className='sender-send-tooltip__label'>{t('chat.queue.stopShortcutTooltip')}</span>
                <ShortcutDisplay shortcut='esc' isMac={isMac} />
              </div>
            </div>
          }
          placement='top'
          classNames={{ root: 'sender-send-tooltip-popover' }}
          trigger={['hover']}
          mouseEnterDelay={.3}
          mouseLeaveDelay={.08}
          arrow={false}
        >
          <div className='sender-control-tooltip-target'>
            <div
              className={buttonClasses}
              onClick={onStop}
            >
              <span className='material-symbols-rounded'>
                stop_circle
              </span>
            </div>
          </div>
        </Tooltip>
      )
    }

    return (
      <Tooltip
        title={
          <div className='sender-send-tooltip'>
            <div className='sender-send-tooltip__row'>
              <span className='sender-send-tooltip__label'>{t('chat.queue.steerShortcutTooltip')}</span>
              <ShortcutDisplay shortcut={queueSteerShortcut} isMac={isMac} />
            </div>
            <div className='sender-send-tooltip__row'>
              <span className='sender-send-tooltip__label'>{t('chat.queue.nextShortcutTooltip')}</span>
              <ShortcutDisplay shortcut={queueNextShortcut} isMac={isMac} />
            </div>
          </div>
        }
        placement='top'
        classNames={{ root: 'sender-send-tooltip-popover' }}
        trigger={['hover']}
        mouseEnterDelay={.3}
        mouseLeaveDelay={.08}
        arrow={false}
      >
        <div className='sender-control-tooltip-target'>
          <div
            className={buttonClasses}
            onClick={isSendDisabled ? undefined : onSend}
          >
            <span className='material-symbols-rounded'>
              send
            </span>
          </div>
        </div>
      </Tooltip>
    )
  }

  return (
    <ShortcutTooltip
      shortcut={resolvedSendShortcut}
      isMac={isMac}
      title={t('chat.sendShortcutTooltip')}
      targetClassName='sender-control-tooltip-target'
      enabled
    >
      <div
        className={buttonClasses}
        onClick={isSendDisabled ? undefined : onSend}
      >
        <span className='material-symbols-rounded'>
          send
        </span>
      </div>
    </ShortcutTooltip>
  )
}
