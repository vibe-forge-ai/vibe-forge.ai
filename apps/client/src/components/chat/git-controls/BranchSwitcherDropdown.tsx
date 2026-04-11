import { Button, Dropdown, Empty, Input, Spin } from 'antd'
import { useTranslation } from 'react-i18next'

import type { GitBranchSummary, GitRepositoryState } from '@vibe-forge/types'

export function BranchSwitcherDropdown({
  availableLocalBranches,
  currentBranchLabel,
  isBusy,
  isLoading,
  open,
  repoState,
  branchQuery,
  canCreateBranch,
  hasBranchResults,
  remoteBranches,
  onCreateBranch,
  onOpenChange,
  onQueryChange,
  onSwitchBranch
}: {
  availableLocalBranches: GitBranchSummary[]
  currentBranchLabel: string
  isBusy: boolean
  isLoading: boolean
  open: boolean
  repoState: GitRepositoryState
  branchQuery: string
  canCreateBranch: boolean
  hasBranchResults: boolean
  remoteBranches: GitBranchSummary[]
  onCreateBranch: (name: string) => void
  onOpenChange: (open: boolean) => void
  onQueryChange: (value: string) => void
  onSwitchBranch: (branch: GitBranchSummary) => void
}) {
  const { t } = useTranslation()

  const renderBranchSection = (title: string, branches: GitBranchSummary[]) => {
    if (branches.length === 0) {
      return null
    }

    return (
      <div className='chat-header-git__section'>
        <span className='chat-header-git__section-label'>{title}</span>
        {branches.map(branch => {
          return (
            <button
              key={`${branch.kind}:${branch.name}`}
              type='button'
              className='chat-header-git__branch-row'
              disabled={isBusy}
              title={branch.name}
              onClick={() => onSwitchBranch(branch)}
            >
              <div className='chat-header-git__branch-row-main'>
                <span className='chat-header-git__row-icon material-symbols-rounded'>
                  {branch.kind === 'local' ? 'call_split' : 'cloud_sync'}
                </span>
                <span className='chat-header-git__row-copy'>
                  <span className='chat-header-git__row-title'>{branch.name}</span>
                </span>
              </div>
              {branch.isCurrent
                ? (
                  <span className='chat-header-git__row-state material-symbols-rounded'>check</span>
                )
                : null}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <Dropdown
      open={open}
      placement='bottomLeft'
      trigger={['click']}
      onOpenChange={onOpenChange}
      dropdownRender={() => (
        <div className='chat-header-git__overlay chat-header-git__overlay--branches'>
          <Input
            allowClear
            autoFocus
            className='chat-header-git__search'
            placeholder={t('chat.gitSearchBranches')}
            prefix={<span className='material-symbols-rounded'>search</span>}
            value={branchQuery}
            onChange={(event) => onQueryChange(event.target.value)}
            onPressEnter={() => {
              if (canCreateBranch) {
                onCreateBranch(branchQuery)
              }
            }}
          />

          {canCreateBranch && (
            <button
              type='button'
              className='chat-header-git__create-row'
              disabled={isBusy}
              onClick={() => onCreateBranch(branchQuery)}
            >
              <div className='chat-header-git__branch-row-main'>
                <span className='chat-header-git__row-icon material-symbols-rounded'>add</span>
                <span className='chat-header-git__row-title'>
                  {t('chat.gitCreateBranchWithName', { branch: branchQuery.trim() })}
                </span>
              </div>
            </button>
          )}

          {isLoading &&
              availableLocalBranches.length === 0 &&
              remoteBranches.length === 0
            ? (
              <div className='chat-header-git__loading'>
                <Spin size='small' />
              </div>
            )
            : hasBranchResults
            ? (
              <div className='chat-header-git__sections'>
                {renderBranchSection(t('chat.gitBranchesLocal'), availableLocalBranches)}
                {renderBranchSection(t('chat.gitBranchesRemote'), remoteBranches)}
              </div>
            )
            : (
              <div className='chat-header-git__empty'>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('chat.gitNoBranches')}
                />
              </div>
            )}
        </div>
      )}
    >
      <Button
        type='text'
        className={`chat-header-git__trigger ${open ? 'is-open' : ''} ${isBusy ? 'is-disabled' : ''}`}
        title={t('chat.gitBranchSwitcher')}
        aria-label={t('chat.gitBranchSwitcher')}
      >
        <span className='chat-header-git__trigger-main'>
          <span className='material-symbols-rounded'>call_split</span>
          <span className='chat-header-git__trigger-label'>{currentBranchLabel}</span>
          {repoState.hasChanges && <span className='chat-header-git__dirty-dot' />}
        </span>
        <span className='chat-header-git__trigger-chevron material-symbols-rounded'>expand_more</span>
      </Button>
    </Dropdown>
  )
}
