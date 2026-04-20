import type { ChatHeaderView } from '#~/components/chat/ChatHeader'

export interface MdpChatRuntimeState {
  activeView: ChatHeaderView
  isTerminalOpen: boolean
  isWorkspaceDrawerOpen: boolean
  openWorkspaceFilePaths: string[]
  selectedWorkspaceFilePath: string | null
  sessionId?: string
}

export interface MdpChatRuntimeHandle {
  closeWorkspaceFile(path?: string): void
  getState(): MdpChatRuntimeState
  openWorkspaceFile(path: string): void
  selectWorkspaceFile(path: string): void
  setActiveView(view: ChatHeaderView): void
  setTerminalOpen(open: boolean): void
  setWorkspaceDrawerOpen(open: boolean): void
}

let activeChatRuntime: MdpChatRuntimeHandle | null = null

export const getMdpChatRuntime = () => activeChatRuntime

export const setMdpChatRuntime = (runtime: MdpChatRuntimeHandle | null) => {
  activeChatRuntime = runtime
}
