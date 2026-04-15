import { Button, Dropdown } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { GitWorktreeSummary, SessionWorkspace } from '@vibe-forge/types'

import { formatGitWorktreePathLabel } from './git-branch-utils'

const getWorkspaceKindIcon = (kind: SessionWorkspace['kind']) => {
  switch (kind) {
    case 'managed_worktree':
      return 'account_tree'
    case 'external_workspace':
      return 'folder_open'
    default:
      return 'folder'
  }
}

const getWorkspaceKindLabel = (kind: SessionWorkspace['kind'], t: (key: string) => string) => {
  switch (kind) {
    case 'managed_worktree':
      return t('chat.sessionWorkspaceManaged')
    case 'external_workspace':
      return t('chat.sessionWorkspaceExternal')
    default:
      return t('chat.sessionWorkspaceShared')
  }
}

const getWorkspaceCleanupLabel = (
  cleanupPolicy: SessionWorkspace['cleanupPolicy'],
  t: (key: string) => string
) => cleanupPolicy === 'delete_on_session_delete'
  ? t('chat.sessionWorkspaceCleanupDelete')
  : t('chat.sessionWorkspaceCleanupRetain')

const getWorkspaceStateLabel = (
  state: SessionWorkspace['state'],
  t: (key: string) => string
) => {
  switch (state) {
    case 'provisioning':
      return t('chat.sessionWorkspaceStateProvisioning')
    case 'deleting':
      return t('chat.sessionWorkspaceStateDeleting')
    case 'deleted':
      return t('chat.sessionWorkspaceStateDeleted')
    case 'broken':
      return t('chat.sessionWorkspaceStateBroken')
    default:
      return t('chat.sessionWorkspaceStateReady')
  }
}

export function GitWorktreeDropdown({
  open,
  workspace,
  worktrees,
  currentBranch,
  onOpenChange
}: {
  open: boolean
  workspace?: SessionWorkspace
  worktrees: GitWorktreeSummary[]
  currentBranch?: string | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()

  const currentWorkspaceTitle = useMemo(() => {
    if (workspace?.workspaceFolder?.trim()) {
      return formatGitWorktreePathLabel(workspace.workspaceFolder)
    }
    const currentWorktree = worktrees.find(item => item.isCurrent)
    return currentWorktree != null
      ? formatGitWorktreePathLabel(currentWorktree.path)
      : t('chat.gitWorktree')
  }, [t, workspace?.workspaceFolder, worktrees])

  const currentWorkspaceMeta = useMemo(() => {
    if (workspace == null) {
      return worktrees.length > 0 ? t('chat.sessionWorkspaceRepositoryWorktrees') : t('chat.gitWorktree')
    }
    return getWorkspaceKindLabel(workspace.kind, t)
  }, [t, workspace, worktrees.length])

  return (
    <Dropdown
      open={open}
      placement='bottomLeft'
      trigger={['click']}
      onOpenChange={onOpenChange}
      dropdownRender={() => (
        <div className='chat-header-git__overlay chat-header-git__overlay--worktrees'>
          {workspace != null && (
            <div className='chat-header-git__workspace-panel'>
              <div className='chat-header-git__workspace-hero'>
                <div className='chat-header-git__workspace-title'>
                  <span className='material-symbols-rounded'>{getWorkspaceKindIcon(workspace.kind)}</span>
                  <span>{t('chat.sessionWorkspace')}</span>
                </div>
                <div className='chat-header-git__workspace-value' title={workspace.workspaceFolder}>
                  {workspace.workspaceFolder}
                </div>
              </div>

              <div className='chat-header-git__workspace-meta-list'>
                <div className='chat-header-git__workspace-meta'>
                  <span>{t('chat.sessionWorkspaceMode')}</span>
                  <strong>{getWorkspaceKindLabel(workspace.kind, t)}</strong>
                </div>
                <div className='chat-header-git__workspace-meta'>
                  <span>{t('chat.sessionWorkspaceState')}</span>
                  <strong>{getWorkspaceStateLabel(workspace.state, t)}</strong>
                </div>
                <div className='chat-header-git__workspace-meta'>
                  <span>{t('chat.sessionWorkspaceCleanup')}</span>
                  <strong>{getWorkspaceCleanupLabel(workspace.cleanupPolicy, t)}</strong>
                </div>
                {currentBranch !== undefined && (
                  <div className='chat-header-git__workspace-meta'>
                    <span>{t('chat.sessionWorkspaceBranch')}</span>
                    <strong>{currentBranch?.trim() || t('chat.gitDetachedHead')}</strong>
                  </div>
                )}
                {workspace.baseRef != null && workspace.baseRef.trim() !== '' && (
                  <div className='chat-header-git__workspace-meta'>
                    <span>{t('chat.sessionWorkspaceBaseRef')}</span>
                    <strong>{workspace.baseRef}</strong>
                  </div>
                )}
              </div>

              {workspace.lastError != null && workspace.lastError.trim() !== '' && (
                <div className='chat-header-git__workspace-error'>
                  {workspace.lastError}
                </div>
              )}
            </div>
          )}

          {worktrees.length > 0 && (
            <div className='chat-header-git__section'>
              <div className='chat-header-git__section-label'>
                {t('chat.sessionWorkspaceRepositoryWorktrees')}
              </div>
              <div className='chat-header-git__worktree-list'>
                {worktrees.map(worktree => (
                  <div
                    key={worktree.path}
                    className='chat-header-git__worktree-row'
                    title={worktree.path}
                  >
                    <div className='chat-header-git__worktree-row-main'>
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
                      <span className='chat-header-git__worktree-chip'>
                        {t('chat.sessionWorkspaceCurrentSession')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    >
      <Button
        type='text'
        className={`chat-header-git__trigger chat-header-git__trigger--workspace ${open ? 'is-open' : ''}`}
        title={workspace != null ? workspace.workspaceFolder : t('chat.gitWorktree')}
        aria-label={t('chat.sessionWorkspace')}
      >
        <span className='chat-header-git__trigger-main'>
          <span className='material-symbols-rounded'>
            {workspace != null ? getWorkspaceKindIcon(workspace.kind) : 'account_tree'}
          </span>
          <span className='chat-header-git__trigger-copy'>
            <span className='chat-header-git__trigger-label'>{currentWorkspaceTitle}</span>
            <span className='chat-header-git__trigger-meta'>{currentWorkspaceMeta}</span>
          </span>
        </span>
        <span className='chat-header-git__trigger-chevron material-symbols-rounded'>expand_more</span>
      </Button>
    </Dropdown>
  )
}
