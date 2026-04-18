import { useState } from 'react'

export type ChatBottomPanelView = 'file' | 'terminal'

export function useChatRouteBottomPanel({
  isTerminalOpen,
  setIsTerminalOpen
}: {
  isTerminalOpen: boolean
  setIsTerminalOpen: (isOpen: boolean) => void
}) {
  const [bottomPanelView, setBottomPanelView] = useState<ChatBottomPanelView>('terminal')
  const [selectedWorkspaceFilePath, setSelectedWorkspaceFilePath] = useState<string | null>(null)
  const [openWorkspaceFilePaths, setOpenWorkspaceFilePaths] = useState<string[]>([])
  const shouldShowTerminal = isTerminalOpen && bottomPanelView === 'terminal'
  const shouldShowFileEditor = selectedWorkspaceFilePath != null && bottomPanelView === 'file'
  const shouldShowBottomPanel = shouldShowTerminal || shouldShowFileEditor

  const handleToggleTerminal = () => {
    if (bottomPanelView !== 'terminal') {
      setBottomPanelView('terminal')
      setIsTerminalOpen(true)
      return
    }

    setIsTerminalOpen(!isTerminalOpen)
  }
  const handleOpenWorkspaceFile = (path: string) => {
    setOpenWorkspaceFilePaths(current => current.includes(path) ? current : [...current, path])
    setSelectedWorkspaceFilePath(path)
    setBottomPanelView('file')
  }
  const handleCloseWorkspaceFile = () => {
    setSelectedWorkspaceFilePath(null)
    setOpenWorkspaceFilePaths([])
    if (isTerminalOpen) {
      setBottomPanelView('terminal')
    }
  }
  const handleSelectWorkspaceFile = (path: string) => {
    setSelectedWorkspaceFilePath(path)
    setBottomPanelView('file')
  }
  const handleCloseWorkspaceFileTab = (path: string) => {
    const nextPaths = openWorkspaceFilePaths.filter(item => item !== path)
    setOpenWorkspaceFilePaths(nextPaths)

    if (selectedWorkspaceFilePath !== path) {
      return
    }

    const closedIndex = openWorkspaceFilePaths.indexOf(path)
    const nextPath = nextPaths[Math.min(Math.max(closedIndex - 1, 0), nextPaths.length - 1)] ?? null
    setSelectedWorkspaceFilePath(nextPath)

    if (nextPath == null && isTerminalOpen) {
      setBottomPanelView('terminal')
    }
  }
  const handleCloseTerminal = () => {
    setIsTerminalOpen(false)
    if (selectedWorkspaceFilePath != null) {
      setBottomPanelView('file')
    }
  }

  return {
    handleCloseTerminal,
    handleCloseWorkspaceFile,
    handleCloseWorkspaceFileTab,
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
