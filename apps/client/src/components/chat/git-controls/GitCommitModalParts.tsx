import { Switch } from 'antd'
import { useTranslation } from 'react-i18next'

import type { GitChangeSummary } from '@vibe-forge/types'

import type { GitCommitNextStep } from './git-commit-utils'

export function GitCommitSummaryGrid({
  changedFilesLabel,
  changesLabel,
  currentBranchLabel,
  formattedAdditions,
  formattedDeletions,
  summary,
  branchLabel
}: {
  changedFilesLabel: string
  changesLabel: string
  currentBranchLabel: string
  formattedAdditions: string
  formattedDeletions: string
  summary: GitChangeSummary | null
  branchLabel: string
}) {
  return (
    <div className='chat-header-git__commit-summary-grid'>
      <div className='chat-header-git__commit-summary-label'>{branchLabel}</div>
      <div className='chat-header-git__commit-summary-value chat-header-git__commit-summary-value--branch'>
        <span className='material-symbols-rounded'>call_split</span>
        <span>{currentBranchLabel}</span>
      </div>

      <div className='chat-header-git__commit-summary-label'>{changesLabel}</div>
      <div className='chat-header-git__commit-summary-value chat-header-git__commit-summary-value--stats'>
        <span>{changedFilesLabel}</span>
        <span className='chat-header-git__commit-summary-delta is-positive'>+{formattedAdditions}</span>
        <span className='chat-header-git__commit-summary-delta is-negative'>-{formattedDeletions}</span>
      </div>
    </div>
  )
}

export function GitCommitToggleRow({
  checked,
  description,
  disabled,
  onChange,
  title
}: {
  checked: boolean
  description: string
  disabled?: boolean
  onChange: (checked: boolean) => void
  title: string
}) {
  return (
    <label className={`chat-header-git__commit-toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <Switch checked={checked} disabled={disabled} onChange={onChange} />
      <div className='chat-header-git__commit-toggle-copy'>
        <div className='chat-header-git__commit-toggle-title'>{title}</div>
        <div className='chat-header-git__commit-toggle-description'>{description}</div>
      </div>
    </label>
  )
}

export function GitCommitNextSteps({
  canCommitAndPush,
  pending,
  selected,
  onChange,
  steps
}: {
  canCommitAndPush: boolean
  pending: boolean
  selected: GitCommitNextStep
  onChange: (value: GitCommitNextStep) => void
  steps: Array<{
    icon: string
    key: GitCommitNextStep
    label: string
  }>
}) {
  return (
    <div className='chat-header-git__commit-next-steps'>
      {steps.map(step => {
        const disabled = pending || (step.key === 'commit-and-push' && !canCommitAndPush)
        const isSelected = selected === step.key
        return (
          <button
            key={step.key}
            aria-pressed={isSelected}
            className={`chat-header-git__commit-next-step ${isSelected ? 'is-selected' : ''}`}
            disabled={disabled}
            type='button'
            onClick={() => onChange(step.key)}
          >
            <div className='chat-header-git__commit-next-step-main'>
              <span className='chat-header-git__row-icon material-symbols-rounded'>{step.icon}</span>
              <span>{step.label}</span>
            </div>
            {isSelected && (
              <span className='chat-header-git__row-state material-symbols-rounded'>check</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function GitCommitForcePushOption({
  checked,
  pending,
  onChange
}: {
  checked: boolean
  pending: boolean
  onChange: (checked: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <div className='chat-header-git__commit-sub-options'>
      <GitCommitToggleRow
        checked={checked}
        description={t('chat.gitForcePushDescription')}
        disabled={pending}
        title={t('chat.gitForcePush')}
        onChange={onChange}
      />
      {checked && (
        <div className='chat-header-git__overlay-meta'>
          {t('chat.gitForcePushHint')}
        </div>
      )}
    </div>
  )
}

export const getGitCommitNextSteps = (t: ReturnType<typeof useTranslation>['t']) => {
  return [
    { key: 'commit', icon: 'commit', label: t('chat.gitCommitShort') },
    { key: 'commit-and-push', icon: 'upload', label: t('chat.gitCommitAndPush') }
  ] satisfies Array<{ icon: string; key: GitCommitNextStep; label: string }>
}
