import { ChatTerminalView } from '#~/components/chat/terminal/ChatTerminalView.js'
import { WorkspaceFileEditorView } from '#~/components/chat/workspace-file-editor/WorkspaceFileEditorView'
import type { ChatRouteBottomPanelState } from '#~/hooks/chat/use-chat-route-bottom-panel'

export function ChatRouteBottomPanel({
  bottomPanel,
  isRendered,
  isVisible,
  sessionId,
  terminalSessionId
}: {
  bottomPanel: ChatRouteBottomPanelState
  isRendered: boolean
  isVisible: boolean
  sessionId?: string
  terminalSessionId: string
}) {
  if (!isRendered) {
    return null
  }

  return (
    <>
      {bottomPanel.shouldShowTerminal &&
        <ChatTerminalView
          key={terminalSessionId}
          isOpen={isVisible}
          sessionId={terminalSessionId}
          onClose={bottomPanel.handleCloseTerminal}
        />}
      {bottomPanel.shouldShowFileEditor && bottomPanel.selectedWorkspaceFilePath != null &&
        <WorkspaceFileEditorView
          key={bottomPanel.selectedWorkspaceFilePath}
          isOpen={isVisible}
          openPaths={bottomPanel.openWorkspaceFilePaths}
          path={bottomPanel.selectedWorkspaceFilePath}
          sessionId={sessionId}
          onClose={bottomPanel.handleCloseWorkspaceFile}
          onCloseAllPaths={bottomPanel.handleCloseAllWorkspaceFileTabs}
          onCloseOtherPaths={bottomPanel.handleCloseOtherWorkspaceFileTabs}
          onClosePath={bottomPanel.handleCloseWorkspaceFileTab}
          onClosePathsToRight={bottomPanel.handleCloseWorkspaceFileTabsToRight}
          onSelectPath={bottomPanel.handleSelectWorkspaceFile}
        />}
    </>
  )
}
