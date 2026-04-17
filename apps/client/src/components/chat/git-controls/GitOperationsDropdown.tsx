import { Button, Dropdown } from 'antd'
import { useTranslation } from 'react-i18next'

import type { GitRepositoryState } from '@vibe-forge/types'
import type { GitOperationKind } from './git-operation-utils'

import { getPrimaryGitOperationKind, isGitOperationDisabled } from './git-operation-utils'

export function GitOperationsDropdown({
  compact = false,
  isBusy,
  open,
  placement = 'bottomLeft',
  repoState,
  onOpenChange,
  onOpenCommit,
  onPush,
  onSync
}: {
  compact?: boolean
  isBusy: boolean
  open: boolean
  placement?: 'bottomLeft' | 'topLeft'
  repoState: GitRepositoryState
  onOpenChange: (open: boolean) => void
  onOpenCommit: () => void
  onPush: () => void
  onSync: () => void
}) {
  const { t } = useTranslation()
  const primaryActionKind = getPrimaryGitOperationKind(repoState)
  const operationKinds: GitOperationKind[] = primaryActionKind == null
    ? ['commit', 'push', 'sync']
    : [
      primaryActionKind,
      ...(['commit', 'push', 'sync'] as GitOperationKind[]).filter(kind => kind !== primaryActionKind)
    ]
  const actionMap = {
    commit: {
      disabled: isBusy || isGitOperationDisabled(repoState, 'commit'),
      icon: 'commit',
      label: t('chat.gitCommitShort'),
      onClick: onOpenCommit
    },
    push: {
      disabled: isBusy || isGitOperationDisabled(repoState, 'push'),
      icon: 'upload',
      label: t('chat.gitPushShort'),
      onClick: onPush
    },
    sync: {
      disabled: isBusy || isGitOperationDisabled(repoState, 'sync'),
      icon: 'sync',
      label: t('chat.gitSyncShort'),
      onClick: onSync
    }
  } satisfies Record<GitOperationKind, {
    disabled: boolean
    icon: string
    label: string
    onClick: () => void
  }>
  const primaryAction = primaryActionKind != null ? actionMap[primaryActionKind] : null

  return (
    <div
      className={`chat-header-git__split chat-header-git__split--operations ${open ? 'is-open' : ''} ${
        compact ? 'is-compact' : ''
      }`.trim()}
    >
      <Button
        type='text'
        className='chat-header-git__split-main'
        disabled={primaryAction?.disabled ?? true}
        title={primaryAction?.label ?? t('chat.gitOperations')}
        aria-label={primaryAction?.label ?? t('chat.gitOperations')}
        onClick={() => {
          primaryAction?.onClick()
        }}
      >
        <span className='material-symbols-rounded'>
          {primaryAction?.icon ?? 'deployed_code'}
        </span>
        <span className='chat-header-git__trigger-label'>
          {primaryAction?.label ?? t('chat.gitOperations')}
        </span>
      </Button>

      {primaryActionKind !== 'commit' && (
        <div className='chat-header-git__split-divider' />
      )}

      <Dropdown
        open={open}
        placement={placement}
        trigger={['click']}
        onOpenChange={onOpenChange}
        dropdownRender={() => (
          <div className='chat-header-git__overlay chat-header-git__overlay--operations'>
            {operationKinds.map(kind => {
              const action = actionMap[kind]
              return (
                <button
                  key={kind}
                  type='button'
                  className='chat-header-git__operation-row'
                  disabled={action.disabled}
                  onClick={action.onClick}
                >
                  <div className='chat-header-git__operation-row-main'>
                    <span className='chat-header-git__row-icon material-symbols-rounded'>{action.icon}</span>
                    <span className='chat-header-git__row-title'>{action.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      >
        <Button
          type='text'
          className='chat-header-git__split-toggle'
          title={t('chat.gitOperations')}
          aria-label={t('chat.gitOperations')}
        >
          <span className='material-symbols-rounded'>expand_more</span>
        </Button>
      </Dropdown>
    </div>
  )
}
