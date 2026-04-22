import { Button, Dropdown, Empty, Input, Spin } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { GitBranchSummary, GitRepositoryState } from '@vibe-forge/types'

import { BranchSwitcherResults } from './BranchSwitcherResults'

export function BranchSwitcherDropdown({
  availableLocalBranches,
  currentBranchLabel,
  compact = false,
  isBusy,
  isLoading,
  open,
  repoState,
  branchQuery,
  canCreateBranch,
  hasBranchResults,
  placement = 'bottomLeft',
  remoteBranches,
  onCreateBranch,
  onOpenChange,
  onQueryChange,
  onSwitchBranch
}: {
  availableLocalBranches: GitBranchSummary[]
  compact?: boolean
  currentBranchLabel: string
  isBusy: boolean
  isLoading: boolean
  open: boolean
  repoState: GitRepositoryState
  branchQuery: string
  canCreateBranch: boolean
  hasBranchResults: boolean
  placement?: 'bottomLeft' | 'topLeft'
  remoteBranches: GitBranchSummary[]
  onCreateBranch: (name: string) => void
  onOpenChange: (open: boolean) => void
  onQueryChange: (value: string) => void
  onSwitchBranch: (branch: GitBranchSummary) => void
}) {
  const { t } = useTranslation()
  const [displayMode, setDisplayMode] = useState<'flat' | 'tree'>('tree')

  return (
    <Dropdown
      open={open}
      placement={placement}
      trigger={['click']}
      onOpenChange={onOpenChange}
      dropdownRender={() => (
        <div className='chat-header-git__overlay chat-header-git__overlay--branches'>
          <div className='chat-header-git__search-row'>
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

            <div
              className='chat-header-git__view-switch'
              role='tablist'
              aria-label={t('chat.gitBranchViewMode')}
            >
              <button
                type='button'
                className={`chat-header-git__view-button ${displayMode === 'tree' ? 'is-active' : ''}`}
                title={t('chat.gitBranchViewTree')}
                aria-label={t('chat.gitBranchViewTree')}
                onClick={() => setDisplayMode('tree')}
              >
                <span className='material-symbols-rounded'>account_tree</span>
              </button>
              <button
                type='button'
                className={`chat-header-git__view-button ${displayMode === 'flat' ? 'is-active' : ''}`}
                title={t('chat.gitBranchViewFlat')}
                aria-label={t('chat.gitBranchViewFlat')}
                onClick={() => setDisplayMode('flat')}
              >
                <span className='material-symbols-rounded'>reorder</span>
              </button>
            </div>
          </div>

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
                <BranchSwitcherResults
                  availableLocalBranches={availableLocalBranches}
                  branchQuery={branchQuery}
                  isBusy={isBusy}
                  mode={displayMode}
                  remoteBranches={remoteBranches}
                  onSwitchBranch={onSwitchBranch}
                />
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
        className={`chat-header-git__trigger chat-header-git__trigger--branch ${open ? 'is-open' : ''} ${
          isBusy ? 'is-disabled' : ''
        } ${compact ? 'is-compact' : ''}`.trim()}
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
