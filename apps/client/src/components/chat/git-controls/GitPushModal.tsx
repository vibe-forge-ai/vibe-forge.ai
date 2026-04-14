import { Button, Modal } from 'antd'
import { useTranslation } from 'react-i18next'

import { GitCommitToggleRow } from './GitCommitModalParts'

export function GitPushModal({
  blockedMessage,
  currentBranchLabel,
  forcePush,
  hasUpstream,
  open,
  pending,
  upstreamLabel,
  onCancel,
  onPush,
  onToggleForcePush
}: {
  blockedMessage: string
  currentBranchLabel: string
  forcePush: boolean
  hasUpstream: boolean
  open: boolean
  pending: boolean
  upstreamLabel: string
  onCancel: () => void
  onPush: () => void
  onToggleForcePush: (checked: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <Modal
      centered
      className='chat-header-git__commit-modal'
      closeIcon={<span className='material-symbols-rounded'>close</span>}
      destroyOnHidden
      footer={null}
      open={open}
      title={null}
      width={456}
      onCancel={onCancel}
    >
      <div className='chat-header-git__commit-sheet'>
        <div className='chat-header-git__commit-icon'>
          <span className='material-symbols-rounded'>upload</span>
        </div>
        <div className='chat-header-git__commit-title'>
          {t('chat.gitPushPanelTitle')}
        </div>

        <div className='chat-header-git__commit-summary-grid'>
          <div className='chat-header-git__commit-summary-label'>{t('chat.gitCommitPanelBranch')}</div>
          <div className='chat-header-git__commit-summary-value chat-header-git__commit-summary-value--branch'>
            <span className='material-symbols-rounded'>call_split</span>
            <span>{currentBranchLabel}</span>
          </div>

          <div className='chat-header-git__commit-summary-label'>{t('chat.gitPushPanelUpstream')}</div>
          <div className='chat-header-git__commit-summary-value chat-header-git__commit-summary-value--branch'>
            <span className='material-symbols-rounded'>cloud_upload</span>
            <span>{upstreamLabel}</span>
          </div>
        </div>

        {!hasUpstream && (
          <div className='chat-header-git__overlay-meta'>
            {t('chat.gitPushPanelUpstreamHint')}
          </div>
        )}

        <div className='chat-header-git__commit-toggles'>
          <GitCommitToggleRow
            checked={forcePush}
            description={t('chat.gitForcePushDescription')}
            disabled={pending}
            title={t('chat.gitForcePush')}
            onChange={onToggleForcePush}
          />
        </div>

        {forcePush && (
          <div className='chat-header-git__overlay-meta'>
            {t('chat.gitForcePushHint')}
          </div>
        )}
        {blockedMessage !== '' && (
          <div className='chat-header-git__overlay-meta'>
            {blockedMessage}
          </div>
        )}

        <div className='chat-header-git__commit-footer'>
          <Button
            className='chat-header-git__commit-submit'
            disabled={blockedMessage !== ''}
            loading={pending}
            type='primary'
            onClick={onPush}
          >
            {t('common.continue')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
