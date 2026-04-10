import { Button, Input, Modal } from 'antd'
import { useTranslation } from 'react-i18next'

import type { GitChangeSummary, GitHeadCommitSummary } from '@vibe-forge/types'

import {
  GitCommitForcePushOption,
  GitCommitNextSteps,
  GitCommitSummaryGrid,
  GitCommitToggleRow,
  getGitCommitNextSteps
} from './GitCommitModalParts'
import type { GitCommitNextStep } from './git-commit-utils'

export function GitCommitModal({
  canCommitAndPush,
  canSubmit,
  commitAmend,
  commitBlockedMessage,
  commitForcePush,
  commitIncludeUnstagedChanges,
  commitMessage,
  commitMessageError,
  commitNextStep,
  commitSkipHooks,
  commitSummary,
  currentBranchLabel,
  headCommit,
  open,
  pending,
  onCancel,
  onCommit,
  onMessageChange,
  onNextStepChange,
  onToggleAmend,
  onToggleForcePush,
  onToggleIncludeUnstagedChanges,
  onToggleSkipHooks
}: {
  canCommitAndPush: boolean
  canSubmit: boolean
  commitAmend: boolean
  commitBlockedMessage: string
  commitForcePush: boolean
  commitIncludeUnstagedChanges: boolean
  commitMessage: string
  commitMessageError: string
  commitNextStep: GitCommitNextStep
  commitSkipHooks: boolean
  commitSummary: GitChangeSummary | null
  currentBranchLabel: string
  headCommit: GitHeadCommitSummary | null
  open: boolean
  pending: boolean
  onCancel: () => void
  onCommit: () => void
  onMessageChange: (value: string) => void
  onNextStepChange: (value: GitCommitNextStep) => void
  onToggleAmend: (checked: boolean) => void
  onToggleForcePush: (checked: boolean) => void
  onToggleIncludeUnstagedChanges: (checked: boolean) => void
  onToggleSkipHooks: (checked: boolean) => void
}) {
  const { i18n, t } = useTranslation()
  const numberFormatter = new Intl.NumberFormat(i18n.language)
  const nextSteps = getGitCommitNextSteps(t)
  return (
    <Modal
      centered
      className='chat-header-git__commit-modal'
      closeIcon={<span className='material-symbols-rounded'>close</span>}
      destroyOnHidden
      footer={null}
      open={open}
      title={null}
      width={592}
      onCancel={onCancel}
    >
      <div className='chat-header-git__commit-sheet'>
        <div className='chat-header-git__commit-icon'>
          <span className='material-symbols-rounded'>commit</span>
        </div>
        <div className='chat-header-git__commit-title'>
          {t('chat.gitCommitPanelTitle')}
        </div>
        <GitCommitSummaryGrid
          branchLabel={t('chat.gitCommitPanelBranch')}
          changedFilesLabel={t('chat.gitChangedFilesCount', {
            count: numberFormatter.format(commitSummary?.changedFiles ?? 0)
          })}
          changesLabel={t('chat.gitCommitPanelChanges')}
          currentBranchLabel={currentBranchLabel}
          formattedAdditions={numberFormatter.format(commitSummary?.additions ?? 0)}
          formattedDeletions={numberFormatter.format(commitSummary?.deletions ?? 0)}
          summary={commitSummary}
        />

        <div className='chat-header-git__commit-toggles'>
          <GitCommitToggleRow
            checked={commitIncludeUnstagedChanges}
            description={commitIncludeUnstagedChanges
              ? t('chat.gitCommitIncludeUnstagedChangesDescription')
              : t('chat.gitCommitOnlyStagedChangesDescription')}
            disabled={pending}
            title={t('chat.gitCommitIncludeUnstagedChanges')}
            onChange={onToggleIncludeUnstagedChanges}
          />

          <GitCommitToggleRow
            checked={commitSkipHooks}
            description={t('chat.gitCommitSkipHooksDescription')}
            disabled={pending}
            title={t('chat.gitCommitSkipHooks')}
            onChange={onToggleSkipHooks}
          />

          <GitCommitToggleRow
            checked={commitAmend}
            description={headCommit == null
              ? t('chat.gitCommitAmendUnavailableDescription')
              : t('chat.gitCommitAmendDescription', { subject: headCommit.subject })}
            disabled={pending || headCommit == null}
            title={t('chat.gitCommitAmend')}
            onChange={onToggleAmend}
          />
        </div>

        <div className='chat-header-git__commit-section-header'>
          <span>{t('chat.gitCommitMessageLabel')}</span>
          {commitAmend && (
            <span className='chat-header-git__overlay-meta'>
              {t('chat.gitCommitMessageOptional')}
            </span>
          )}
        </div>

        <Input.TextArea
          autoFocus
          className='chat-header-git__commit-input'
          placeholder={commitAmend
            ? t('chat.gitCommitMessagePlaceholderAmend')
            : t('chat.gitCommitMessagePlaceholder')}
          rows={3}
          status={commitMessageError !== '' ? 'error' : undefined}
          value={commitMessage}
          onChange={(event) => onMessageChange(event.target.value)}
        />

        {commitMessageError !== '' && (
          <div className='chat-header-git__commit-error'>{commitMessageError}</div>
        )}
        {commitMessageError === '' && commitAmend && (
          <div className='chat-header-git__overlay-meta'>
            {t('chat.gitCommitMessageAmendHint')}
          </div>
        )}

        <div className='chat-header-git__commit-section-header'>
          <span>{t('chat.gitCommitNextStep')}</span>
        </div>

        <GitCommitNextSteps
          canCommitAndPush={canCommitAndPush}
          pending={pending}
          selected={commitNextStep}
          steps={nextSteps}
          onChange={onNextStepChange}
        />

        {commitNextStep === 'commit-and-push' && (
          <GitCommitForcePushOption
            checked={commitForcePush}
            pending={pending}
            onChange={onToggleForcePush}
          />
        )}

        {!canSubmit && commitBlockedMessage !== '' && (
          <div className='chat-header-git__overlay-meta'>
            {commitBlockedMessage}
          </div>
        )}

        <div className='chat-header-git__commit-footer'>
          <Button
            className='chat-header-git__commit-submit'
            disabled={!canSubmit}
            loading={pending}
            type='primary'
            onClick={onCommit}
          >
            {t('common.continue')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
