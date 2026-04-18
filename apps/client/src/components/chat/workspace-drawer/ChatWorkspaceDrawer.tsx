import './ChatWorkspaceDrawer.scss'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { GitRepositoryState } from '@vibe-forge/types'

import { getSessionGitState, getWorkspaceGitState } from '#~/api'

import { ChatWorkspaceDrawerToolbar } from './ChatWorkspaceDrawerToolbar'
import type { WorkspaceDrawerView } from './ChatWorkspaceDrawerToolbar'
import { WorkspaceDrawerChangedFiles } from './WorkspaceDrawerChangedFiles'
import { WorkspaceDrawerTree } from './WorkspaceDrawerTree'
import type { ChangedFilesLayout, ChangedTreeCommand } from './changed-files-model'
import type { WorkspaceTreeCommand } from './workspace-drawer-tree-types'

export function ChatWorkspaceDrawer({
  onOpenFile,
  selectedFilePath,
  sessionId
}: {
  onOpenFile?: (path: string) => void
  selectedFilePath?: string | null
  sessionId?: string
}) {
  const { t } = useTranslation()
  const [activeView, setActiveView] = useState<WorkspaceDrawerView>('tree')
  const [changedLayout, setChangedLayout] = useState<ChangedFilesLayout>('folders')
  const [changedTreeCommand, setChangedTreeCommand] = useState<ChangedTreeCommand | null>(null)
  const [workspaceTreeCommand, setWorkspaceTreeCommand] = useState<WorkspaceTreeCommand | null>(null)
  const [treeRefreshKey, setTreeRefreshKey] = useState(0)
  const gitKey = sessionId != null && sessionId !== ''
    ? ['chat-workspace-drawer-git', sessionId]
    : 'chat-workspace-drawer-git'
  const {
    data: repoState,
    isLoading: isGitLoading,
    mutate: mutateGitState
  } = useSWR<GitRepositoryState>(
    gitKey,
    () => sessionId != null && sessionId !== '' ? getSessionGitState(sessionId) : getWorkspaceGitState(),
    { refreshInterval: 3000, revalidateOnFocus: true }
  )
  const changedFilesCount = repoState?.available === true ? repoState.changedFiles?.length ?? 0 : 0

  const handleForceSync = () => {
    void mutateGitState()
    setTreeRefreshKey(value => value + 1)
  }
  const handleChangedTreeCommand = (action: ChangedTreeCommand['action']) => {
    setActiveView('changes')
    setChangedLayout('folders')
    setChangedTreeCommand(prev => ({
      action,
      id: (prev?.id ?? 0) + 1
    }))
  }
  const handleWorkspaceTreeCommand = (action: WorkspaceTreeCommand['action']) => {
    setActiveView('tree')
    setWorkspaceTreeCommand(prev => ({
      action,
      id: (prev?.id ?? 0) + 1
    }))
  }

  return (
    <aside className='chat-workspace-drawer' aria-label={t('chat.workspaceDrawerTitle')}>
      <ChatWorkspaceDrawerToolbar
        activeView={activeView}
        changedFilesCount={changedFilesCount}
        changedLayout={changedLayout}
        onActiveViewChange={setActiveView}
        onChangedLayoutChange={setChangedLayout}
        onChangedTreeCommand={handleChangedTreeCommand}
        onForceSync={handleForceSync}
        onWorkspaceTreeCommand={handleWorkspaceTreeCommand}
      />

      <div className='chat-workspace-drawer__body'>
        <div key={activeView} className='chat-workspace-drawer__view-panel'>
          {activeView === 'tree'
            ? (
              <WorkspaceDrawerTree
                command={workspaceTreeCommand}
                refreshKey={treeRefreshKey}
                selectedFilePath={selectedFilePath}
                sessionId={sessionId}
                onOpenFile={onOpenFile}
              />
            )
            : (
              <WorkspaceDrawerChangedFiles
                command={changedTreeCommand}
                isLoading={isGitLoading}
                layout={changedLayout}
                repoState={repoState}
                selectedFilePath={selectedFilePath}
                onOpenFile={onOpenFile}
              />
            )}
        </div>
      </div>
    </aside>
  )
}
