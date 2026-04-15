import type { CSSProperties } from 'react'

import type { GitBranchSummary } from '@vibe-forge/types'

import type { GitBranchTreeEntry } from './git-branch-tree'

export function BranchTreeEntries({
  collapsedFolderKeys,
  depth = 0,
  hasSearchQuery,
  isBusy,
  treeEntries,
  onSwitchBranch,
  onToggleFolder
}: {
  collapsedFolderKeys: string[]
  depth?: number
  hasSearchQuery: boolean
  isBusy: boolean
  treeEntries: GitBranchTreeEntry[]
  onSwitchBranch: (branch: GitBranchSummary) => void
  onToggleFolder: (folderKey: string) => void
}) {
  const getTreeRowStyle = (value: number): CSSProperties => ({
    ['--branch-depth' as string]: value
  })

  return treeEntries.map(entry => {
    if (entry.type === 'folder') {
      const isCollapsed = !hasSearchQuery && collapsedFolderKeys.includes(entry.folder.key)
      return (
        <div
          key={`folder:${entry.folder.key}`}
          className={`chat-header-git__branch-tree-folder ${isCollapsed ? 'is-collapsed' : ''}`}
        >
          <button
            type='button'
            className='chat-header-git__branch-folder-row'
            aria-expanded={!isCollapsed}
            style={getTreeRowStyle(depth)}
            onClick={() => onToggleFolder(entry.folder.key)}
          >
            <span className='chat-header-git__row-icon chat-header-git__branch-folder-chevron material-symbols-rounded'>
              expand_more
            </span>
            <span className='chat-header-git__row-icon material-symbols-rounded'>
              {isCollapsed ? 'folder' : 'folder_open'}
            </span>
            <span className='chat-header-git__row-title'>{entry.folder.label}</span>
          </button>
          <div
            className={`chat-header-git__branch-tree-collapse ${isCollapsed ? 'is-collapsed' : ''}`}
            aria-hidden={isCollapsed}
          >
            <div className='chat-header-git__branch-tree-collapse-inner'>
              <div className='chat-header-git__branch-tree-children'>
                <BranchTreeEntries
                  collapsedFolderKeys={collapsedFolderKeys}
                  depth={depth + 1}
                  hasSearchQuery={hasSearchQuery}
                  isBusy={isBusy}
                  treeEntries={entry.folder.entries}
                  onSwitchBranch={onSwitchBranch}
                  onToggleFolder={onToggleFolder}
                />
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <button
        key={`${entry.branch.kind}:${entry.branch.name}`}
        type='button'
        className='chat-header-git__branch-row chat-header-git__branch-row--tree'
        disabled={isBusy}
        title={entry.branch.name}
        style={getTreeRowStyle(depth)}
        onClick={() => onSwitchBranch(entry.branch)}
      >
        <div className='chat-header-git__branch-row-main'>
          <span className='chat-header-git__row-icon material-symbols-rounded'>
            {entry.branch.kind === 'local' ? 'call_split' : 'cloud_sync'}
          </span>
          <span className='chat-header-git__row-copy'>
            <span className='chat-header-git__row-title'>{entry.label}</span>
          </span>
        </div>
        {entry.branch.isCurrent
          ? (
            <span className='chat-header-git__row-state material-symbols-rounded'>check</span>
          )
          : null}
      </button>
    )
  })
}
