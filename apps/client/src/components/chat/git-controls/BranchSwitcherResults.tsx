import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { GitBranchSummary } from '@vibe-forge/types'

import { BranchTreeEntries } from './BranchTreeEntries'
import type { GitBranchDisplayMode } from './git-branch-tree'
import {
  buildGitBranchTree,
  collectGitBranchTreeFolderKeys,
  getGitBranchTreeFolderKeysForBranch
} from './git-branch-tree'

export function BranchSwitcherResults({
  availableLocalBranches,
  branchQuery,
  isBusy,
  mode,
  remoteBranches,
  onSwitchBranch
}: {
  availableLocalBranches: GitBranchSummary[]
  branchQuery: string
  isBusy: boolean
  mode: GitBranchDisplayMode
  remoteBranches: GitBranchSummary[]
  onSwitchBranch: (branch: GitBranchSummary) => void
}) {
  const { t } = useTranslation()
  const localBranchTree = useMemo(
    () => buildGitBranchTree(availableLocalBranches, 'local'),
    [availableLocalBranches]
  )
  const remoteBranchTree = useMemo(
    () => buildGitBranchTree(remoteBranches, 'remote'),
    [remoteBranches]
  )
  const [collapsedFolderKeys, setCollapsedFolderKeys] = useState<string[]>([])
  const hasSearchQuery = branchQuery.trim() !== ''
  const currentLocalBranch = useMemo(
    () => availableLocalBranches.find(branch => branch.isCurrent),
    [availableLocalBranches]
  )
  const currentRemoteBranch = useMemo(
    () => remoteBranches.find(branch => branch.isCurrent),
    [remoteBranches]
  )

  const unifiedTreeEntries = useMemo(() => {
    const entries = []
    if (localBranchTree.length > 0) {
      entries.push({
        type: 'folder' as const,
        folder: {
          entries: localBranchTree,
          hasCurrentBranch: currentLocalBranch != null,
          key: 'local',
          label: t('chat.gitBranchesLocal')
        }
      })
    }
    if (remoteBranchTree.length > 0) {
      entries.push({
        type: 'folder' as const,
        folder: {
          entries: remoteBranchTree,
          hasCurrentBranch: currentRemoteBranch != null,
          key: 'remote',
          label: t('chat.gitBranchesRemote')
        }
      })
    }

    return entries.sort((left, right) => {
      if (left.folder.hasCurrentBranch !== right.folder.hasCurrentBranch) {
        return left.folder.hasCurrentBranch ? -1 : 1
      }

      return left.folder.label.localeCompare(right.folder.label)
    })
  }, [currentLocalBranch, currentRemoteBranch, localBranchTree, remoteBranchTree, t])

  const allFolderKeys = useMemo(
    () => new Set(collectGitBranchTreeFolderKeys(unifiedTreeEntries)),
    [unifiedTreeEntries]
  )
  const defaultExpandedFolderKeys = useMemo(
    () => new Set([
      ...(currentLocalBranch != null ? getGitBranchTreeFolderKeysForBranch(currentLocalBranch, 'local') : []),
      ...(currentRemoteBranch != null ? getGitBranchTreeFolderKeysForBranch(currentRemoteBranch, 'remote') : [])
    ]),
    [currentLocalBranch, currentRemoteBranch]
  )

  useEffect(() => {
    setCollapsedFolderKeys(
      Array.from(allFolderKeys).filter(key => !defaultExpandedFolderKeys.has(key))
    )
  }, [allFolderKeys, defaultExpandedFolderKeys])

  const toggleFolder = (folderKey: string) => {
    setCollapsedFolderKeys(currentKeys => (
      currentKeys.includes(folderKey)
        ? currentKeys.filter(key => key !== folderKey)
        : [...currentKeys, folderKey]
    ))
  }

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

  return mode === 'tree'
    ? (
      <div className='chat-header-git__branch-tree'>
        <BranchTreeEntries
          collapsedFolderKeys={collapsedFolderKeys}
          hasSearchQuery={hasSearchQuery}
          isBusy={isBusy}
          treeEntries={unifiedTreeEntries}
          onSwitchBranch={onSwitchBranch}
          onToggleFolder={toggleFolder}
        />
      </div>
    )
    : (
      <>
        {renderBranchSection(t('chat.gitBranchesLocal'), availableLocalBranches)}
        {renderBranchSection(t('chat.gitBranchesRemote'), remoteBranches)}
      </>
    )
}
