import { useEffect, useState } from 'react'

import type { Session } from '@vibe-forge/core'

import { updateSession } from '#~/api'

import {
  normalizeWorkspaceFileState,
  toSessionWorkspaceFileState,
  uniqueNonEmptyPaths
} from './workspace-file-panel-state'
import type { WorkspaceFilePanelState } from './workspace-file-panel-state'

export type ChatBottomPanelView = 'file' | 'terminal'

export function useChatRouteBottomPanel({
  isTerminalOpen,
  session,
  setIsTerminalOpen
}: {
  isTerminalOpen: boolean
  session?: Session
  setIsTerminalOpen: (isOpen: boolean) => void
}) {
  const initialWorkspaceFileState = normalizeWorkspaceFileState(session?.workspaceFileState)
  const [bottomPanelView, setBottomPanelView] = useState<ChatBottomPanelView>('terminal')
  const [selectedWorkspaceFilePath, setSelectedWorkspaceFilePath] = useState<string | null>(
    initialWorkspaceFileState.selectedPath
  )
  const [openWorkspaceFilePaths, setOpenWorkspaceFilePaths] = useState<string[]>(initialWorkspaceFileState.openPaths)
  const [isWorkspaceFileEditorOpen, setIsWorkspaceFileEditorOpen] = useState(initialWorkspaceFileState.isOpen)
  const shouldShowTerminal = isTerminalOpen && bottomPanelView === 'terminal'
  const shouldShowFileEditor = isWorkspaceFileEditorOpen && selectedWorkspaceFilePath != null &&
    bottomPanelView === 'file'
  const shouldShowBottomPanel = shouldShowTerminal || shouldShowFileEditor
  const persistedWorkspaceFileStateKey = JSON.stringify(session?.workspaceFileState ?? null)

  useEffect(() => {
    const nextState = normalizeWorkspaceFileState(session?.workspaceFileState)
    setOpenWorkspaceFilePaths(nextState.openPaths)
    setSelectedWorkspaceFilePath(nextState.selectedPath)
    setIsWorkspaceFileEditorOpen(nextState.isOpen)
    setBottomPanelView(current => {
      if (nextState.isOpen && nextState.selectedPath != null) {
        return 'file'
      }
      return current === 'file' ? 'terminal' : current
    })
  }, [persistedWorkspaceFileStateKey, session?.id])

  const commitWorkspaceFileState = (state: WorkspaceFilePanelState) => {
    const nextState = normalizeWorkspaceFileState(state)
    setOpenWorkspaceFilePaths(nextState.openPaths)
    setSelectedWorkspaceFilePath(nextState.selectedPath)
    setIsWorkspaceFileEditorOpen(nextState.isOpen)

    if (session?.id != null) {
      void updateSession(session.id, {
        workspaceFileState: toSessionWorkspaceFileState(nextState)
      }).catch((err: unknown) => {
        console.error('[chat] failed to persist workspace file state:', err)
      })
    }
  }

  const handleToggleTerminal = () => {
    if (bottomPanelView !== 'terminal') {
      setBottomPanelView('terminal')
      setIsTerminalOpen(true)
      return
    }

    setIsTerminalOpen(!isTerminalOpen)
  }
  const handleOpenWorkspaceFile = (path: string) => {
    commitWorkspaceFileState({
      openPaths: uniqueNonEmptyPaths([...openWorkspaceFilePaths, path]),
      selectedPath: path,
      isOpen: true
    })
    setBottomPanelView('file')
  }
  const handleCloseWorkspaceFile = () => {
    commitWorkspaceFileState({
      openPaths: openWorkspaceFilePaths,
      selectedPath: selectedWorkspaceFilePath,
      isOpen: false
    })
    if (isTerminalOpen) {
      setBottomPanelView('terminal')
    }
  }
  const handleCloseAllWorkspaceFileTabs = () => {
    commitWorkspaceFileState({
      openPaths: [],
      selectedPath: null,
      isOpen: false
    })
    if (isTerminalOpen) {
      setBottomPanelView('terminal')
    }
  }
  const handleSelectWorkspaceFile = (path: string) => {
    commitWorkspaceFileState({
      openPaths: uniqueNonEmptyPaths([...openWorkspaceFilePaths, path]),
      selectedPath: path,
      isOpen: true
    })
    setBottomPanelView('file')
  }
  const handleCloseWorkspaceFileTab = (path: string) => {
    const nextPaths = openWorkspaceFilePaths.filter(item => item !== path)
    const closedIndex = openWorkspaceFilePaths.indexOf(path)
    const nextPath = selectedWorkspaceFilePath === path
      ? nextPaths[Math.min(Math.max(closedIndex - 1, 0), nextPaths.length - 1)] ?? null
      : selectedWorkspaceFilePath

    commitWorkspaceFileState({
      openPaths: nextPaths,
      selectedPath: nextPath,
      isOpen: isWorkspaceFileEditorOpen && nextPath != null
    })

    if (nextPath == null && isTerminalOpen) {
      setBottomPanelView('terminal')
    }
  }
  const handleCloseOtherWorkspaceFileTabs = (path: string) => {
    if (!openWorkspaceFilePaths.includes(path)) {
      return
    }

    commitWorkspaceFileState({
      openPaths: [path],
      selectedPath: path,
      isOpen: true
    })
    setBottomPanelView('file')
  }
  const handleCloseWorkspaceFileTabsToRight = (path: string) => {
    const tabIndex = openWorkspaceFilePaths.indexOf(path)
    if (tabIndex < 0) {
      return
    }

    const nextPaths = openWorkspaceFilePaths.slice(0, tabIndex + 1)
    const nextPath = selectedWorkspaceFilePath != null && nextPaths.includes(selectedWorkspaceFilePath)
      ? selectedWorkspaceFilePath
      : path
    commitWorkspaceFileState({
      openPaths: nextPaths,
      selectedPath: nextPath,
      isOpen: isWorkspaceFileEditorOpen && nextPath != null
    })
  }
  const handleCloseTerminal = () => {
    setIsTerminalOpen(false)
    if (isWorkspaceFileEditorOpen && selectedWorkspaceFilePath != null) {
      setBottomPanelView('file')
    }
  }

  return {
    handleCloseAllWorkspaceFileTabs,
    handleCloseTerminal,
    handleCloseWorkspaceFile,
    handleCloseOtherWorkspaceFileTabs,
    handleCloseWorkspaceFileTab,
    handleCloseWorkspaceFileTabsToRight,
    handleOpenWorkspaceFile,
    handleSelectWorkspaceFile,
    handleToggleTerminal,
    openWorkspaceFilePaths,
    selectedWorkspaceFilePath,
    shouldShowBottomPanel,
    shouldShowFileEditor,
    shouldShowTerminal
  }
}

export type ChatRouteBottomPanelState = ReturnType<typeof useChatRouteBottomPanel>
