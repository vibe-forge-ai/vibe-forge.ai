import { ChatTerminalView } from '#~/components/chat/terminal/ChatTerminalView.js'
import { WorkspaceFileEditorView } from '#~/components/chat/workspace-file-editor/WorkspaceFileEditorView'

export function ChatRouteBottomPanel({
  isRendered,
  isVisible,
  onCloseFileEditor,
  onCloseTerminal,
  onCloseWorkspaceFileTab,
  onSelectWorkspaceFile,
  openWorkspaceFilePaths,
  selectedWorkspaceFilePath,
  sessionId,
  shouldShowFileEditor,
  shouldShowTerminal,
  terminalSessionId
}: {
  isRendered: boolean
  isVisible: boolean
  onCloseFileEditor: () => void
  onCloseTerminal: () => void
  onCloseWorkspaceFileTab: (path: string) => void
  onSelectWorkspaceFile: (path: string) => void
  openWorkspaceFilePaths: string[]
  selectedWorkspaceFilePath: string | null
  sessionId?: string
  shouldShowFileEditor: boolean
  shouldShowTerminal: boolean
  terminalSessionId: string
}) {
  if (!isRendered) {
    return null
  }

  return (
    <>
      {shouldShowTerminal &&
        <ChatTerminalView
          key={terminalSessionId}
          isOpen={isVisible}
          sessionId={terminalSessionId}
          onClose={onCloseTerminal}
        />}
      {shouldShowFileEditor && selectedWorkspaceFilePath != null &&
        <WorkspaceFileEditorView
          key={selectedWorkspaceFilePath}
          isOpen={isVisible}
          openPaths={openWorkspaceFilePaths}
          path={selectedWorkspaceFilePath}
          sessionId={sessionId}
          onClose={onCloseFileEditor}
          onClosePath={onCloseWorkspaceFileTab}
          onSelectPath={onSelectWorkspaceFile}
        />}
    </>
  )
}
