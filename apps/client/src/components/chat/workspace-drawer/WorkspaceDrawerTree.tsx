import type { ContextPickerFile } from '#~/components/workspace/context-file-types'
import { toContextPickerFile } from '#~/components/workspace/context-file-types'
import { ProjectFileTree } from '#~/components/workspace/project-file-tree/ProjectFileTree'
import type { ProjectFileTreeCommand } from '#~/components/workspace/project-file-tree/project-file-tree-types'

export function WorkspaceDrawerTree({
  command,
  onOpenFile,
  onReferencePaths,
  refreshKey,
  selectedFilePath,
  sessionId
}: {
  command: ProjectFileTreeCommand | null
  onOpenFile?: (path: string) => void
  onReferencePaths?: (files: ContextPickerFile[]) => void
  refreshKey: number
  selectedFilePath?: string | null
  sessionId?: string
}) {
  return (
    <ProjectFileTree
      activePath={selectedFilePath}
      className='chat-workspace-drawer__tree'
      command={command}
      refreshKey={refreshKey}
      selectableTypes='all'
      selectionMode='multiple'
      sessionId={sessionId}
      showContextMenu
      onOpenFile={onOpenFile}
      onReferenceNodes={nodes => onReferencePaths?.(nodes.map(toContextPickerFile))}
    />
  )
}
