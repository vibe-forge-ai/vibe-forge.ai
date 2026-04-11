import { Button, Dropdown } from 'antd'
import { useTranslation } from 'react-i18next'

import type { GitWorktreeSummary } from '@vibe-forge/types'

import { formatGitWorktreePathLabel } from './git-branch-utils'

export function GitWorktreeDropdown({
  open,
  worktrees,
  onOpenChange
}: {
  open: boolean
  worktrees: GitWorktreeSummary[]
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <Dropdown
      open={open}
      placement='bottomLeft'
      trigger={['click']}
      onOpenChange={onOpenChange}
      dropdownRender={() => (
        <div className='chat-header-git__overlay chat-header-git__overlay--worktrees'>
          <div className='chat-header-git__worktree-list'>
            {worktrees.map(worktree => (
              <div
                key={worktree.path}
                className='chat-header-git__worktree-row'
                title={worktree.path}
              >
                <div className='chat-header-git__branch-row-main'>
                  <span className='chat-header-git__row-icon material-symbols-rounded'>folder_open</span>
                  <span className='chat-header-git__row-copy'>
                    <span className='chat-header-git__row-title'>
                      {formatGitWorktreePathLabel(worktree.path)}
                    </span>
                    <span className='chat-header-git__row-subtitle'>
                      {worktree.branchName?.trim() || t('chat.gitDetachedHead')}
                    </span>
                  </span>
                </div>
                {worktree.isCurrent && (
                  <span className='chat-header-git__row-state material-symbols-rounded'>check</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    >
      <Button
        type='text'
        className={`chat-header-git__trigger ${open ? 'is-open' : ''}`}
        title={t('chat.gitWorktree')}
        aria-label={t('chat.gitWorktree')}
      >
        <span className='chat-header-git__trigger-main'>
          <span className='material-symbols-rounded'>account_tree</span>
          <span className='chat-header-git__trigger-label'>{t('chat.gitWorktree')}</span>
        </span>
        <span className='chat-header-git__trigger-chevron material-symbols-rounded'>expand_more</span>
      </Button>
    </Dropdown>
  )
}
