import { Input, Modal } from 'antd'
import { useTranslation } from 'react-i18next'

export function GitCommitModal({
  commitMessage,
  commitMessageError,
  open,
  pending,
  onCancel,
  onCommit,
  onMessageChange
}: {
  commitMessage: string
  commitMessageError: string
  open: boolean
  pending: boolean
  onCancel: () => void
  onCommit: () => void
  onMessageChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <Modal
      destroyOnHidden
      okText={t('chat.gitCommitShort')}
      cancelText={t('common.cancel')}
      open={open}
      title={t('chat.gitCommitDialogTitle')}
      okButtonProps={{ loading: pending }}
      onCancel={onCancel}
      onOk={onCommit}
    >
      <p className='chat-header-git__commit-note'>{t('chat.gitCommitDescription')}</p>
      <Input.TextArea
        autoFocus
        className='chat-header-git__commit-input'
        placeholder={t('chat.gitCommitMessagePlaceholder')}
        rows={4}
        status={commitMessageError !== '' ? 'error' : undefined}
        value={commitMessage}
        onChange={(event) => onMessageChange(event.target.value)}
      />
      {commitMessageError !== '' && (
        <div className='chat-header-git__overlay-meta'>{commitMessageError}</div>
      )}
    </Modal>
  )
}
