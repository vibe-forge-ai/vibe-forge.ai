import '../sender-toolbar/SenderSelectShared.scss'
import './SenderSubmitAction.scss'

import { Button } from 'antd'
import { useTranslation } from 'react-i18next'

import { ShortcutTooltip } from '#~/components/ShortcutTooltip'

export function SenderSubmitAction({
  isInlineEdit,
  submitLoading,
  submitLabel,
  hasComposerContent,
  hasSendText,
  modelUnavailable,
  isThinking,
  resolvedSendShortcut,
  isMac,
  onCancel,
  onSend,
  onInterrupt
}: {
  isInlineEdit: boolean
  submitLoading: boolean
  submitLabel?: string
  hasComposerContent: boolean
  hasSendText: boolean
  modelUnavailable: boolean
  isThinking: boolean
  resolvedSendShortcut: string
  isMac: boolean
  onCancel?: () => void
  onSend: () => void
  onInterrupt: () => void
}) {
  const { t } = useTranslation()

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

  return (
    <ShortcutTooltip
      shortcut={resolvedSendShortcut}
      isMac={isMac}
      title={t('chat.sendShortcutTooltip')}
      targetClassName='sender-control-tooltip-target'
      enabled={!isThinking}
    >
      <div
        className={`chat-send-btn ${hasSendText && !modelUnavailable ? 'active' : ''} ${isThinking ? 'thinking' : ''} ${
          modelUnavailable ? 'disabled' : ''
        }`.trim()}
        onClick={modelUnavailable ? undefined : (isThinking ? onInterrupt : onSend)}
      >
        <span className='material-symbols-rounded'>
          {isThinking ? 'stop_circle' : 'send'}
        </span>
      </div>
    </ShortcutTooltip>
  )
}
