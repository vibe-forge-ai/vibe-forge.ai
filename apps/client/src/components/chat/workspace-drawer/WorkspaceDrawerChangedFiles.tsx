import { Button, Empty, Spin } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { GitRepositoryState } from '@vibe-forge/types'

import { WorkspaceDrawerChangedFileRow } from './WorkspaceDrawerChangedFileRow'
import { WorkspaceDrawerChangedFolderTree } from './WorkspaceDrawerChangedFolderTree'
import type {
  ChangedFileScope,
  ChangedFilesLayout,
  ChangedTreeCommand,
  SelectedChangedFolder
} from './changed-files-model'
import { buildChangedFolderTree, getChangedFileSections } from './changed-files-model'

export function WorkspaceDrawerChangedFiles({
  command,
  isLoading,
  layout,
  onOpenFile,
  repoState,
  selectedFilePath
}: {
  command: ChangedTreeCommand | null
  isLoading: boolean
  layout: ChangedFilesLayout
  onOpenFile?: (path: string) => void
  repoState?: GitRepositoryState
  selectedFilePath?: string | null
}) {
  const { t } = useTranslation()
  const [collapsedScopes, setCollapsedScopes] = useState<Set<ChangedFileScope>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<SelectedChangedFolder | null>(null)
  const changedFiles = useMemo(() => {
    if (repoState?.available !== true) {
      return []
    }
    return repoState.changedFiles ?? []
  }, [repoState])
  const sections = useMemo(() => getChangedFileSections(changedFiles), [changedFiles])
  const sectionScopes = useMemo(() => sections.map(section => section.scope), [sections])
  const sectionTrees = useMemo(() => {
    return new Map(sections.map(section => [section.scope, buildChangedFolderTree(section.entries)]))
  }, [sections])

  useEffect(() => {
    setCollapsedScopes(prev => new Set(Array.from(prev).filter(scope => sectionScopes.includes(scope))))
  }, [sectionScopes])

  useEffect(() => {
    if (layout !== 'folders') {
      setSelectedFolder(null)
    }
  }, [layout])

  useEffect(() => {
    if (command == null) {
      return
    }

    if (selectedFolder == null) {
      setCollapsedScopes(command.action === 'expand' ? new Set() : new Set(sectionScopes))
      return
    }

    if (command.action === 'expand') {
      setCollapsedScopes((prev) => {
        const next = new Set(prev)
        next.delete(selectedFolder.scope)
        return next
      })
    }
  }, [command, sectionScopes, selectedFolder])

  const toggleSection = (scope: ChangedFileScope) => {
    setCollapsedScopes((prev) => {
      const next = new Set(prev)
      if (next.has(scope)) {
        next.delete(scope)
      } else {
        next.add(scope)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className='chat-workspace-drawer__loading'>
        <Spin size='small' />
        <span>{t('chat.workspaceDrawerLoadingGit')}</span>
      </div>
    )
  }

  if (repoState != null && repoState.available !== true) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('chat.workspaceDrawerGitUnavailable')} />
  }

  if (sections.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('chat.workspaceDrawerNoChangedFiles')} />
  }

  return (
    <div className='chat-workspace-drawer__changed-list'>
      <div className='chat-workspace-drawer__changed-sections'>
        {sections.map((section) => {
          const isCollapsed = collapsedScopes.has(section.scope)
          return (
            <section key={section.scope} className='chat-workspace-drawer__changed-section'>
              <div className='chat-workspace-drawer__changed-section-header'>
                <span>{t(`chat.workspaceDrawerChangedSection.${section.scope}`)}</span>
                <span className='chat-workspace-drawer__changed-section-meta'>
                  <span>{section.count}</span>
                  <Button
                    type='text'
                    className='chat-workspace-drawer__changed-section-toggle'
                    aria-label={t('chat.workspaceDrawerToggleSection')}
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleSection(section.scope)}
                  >
                    <span className='material-symbols-rounded'>{isCollapsed ? 'expand_more' : 'expand_less'}</span>
                  </Button>
                </span>
              </div>
              <div
                className={`chat-workspace-drawer__changed-section-body ${
                  isCollapsed ? 'is-collapsed' : 'is-expanded'
                }`}
              >
                <div className='chat-workspace-drawer__changed-section-body-inner'>
                  {layout === 'folders'
                    ? (
                      <WorkspaceDrawerChangedFolderTree
                        command={command}
                        root={sectionTrees.get(section.scope) ?? buildChangedFolderTree([])}
                        scope={section.scope}
                        selectedFolder={selectedFolder}
                        selectedFilePath={selectedFilePath}
                        onOpenFile={onOpenFile}
                        onSelectFolder={setSelectedFolder}
                      />
                    )
                    : section.entries.map(entry => (
                      <WorkspaceDrawerChangedFileRow
                        key={entry.key}
                        entry={entry}
                        selectedFilePath={selectedFilePath}
                        onOpenFile={onOpenFile}
                      />
                    ))}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
