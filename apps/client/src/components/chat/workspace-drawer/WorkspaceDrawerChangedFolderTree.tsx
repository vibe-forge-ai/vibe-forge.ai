import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { WorkspaceDrawerChangedFileRow } from './WorkspaceDrawerChangedFileRow'
import type {
  ChangedFileScope,
  ChangedFolderNode,
  ChangedTreeCommand,
  SelectedChangedFolder
} from './changed-files-model'
import { collectChangedFolderPaths, findChangedFolderNode } from './changed-files-model'

const getFolderDepthStyle = (depth: number): CSSProperties => ({
  '--changed-folder-depth': depth
} as CSSProperties)

const getCompactFolderNode = (node: ChangedFolderNode) => {
  const names = [node.name]
  let current = node

  while (current.entries.length === 0 && current.children.length === 1) {
    current = current.children[0]!
    names.push(current.name)
  }

  return {
    label: names.join('/'),
    node: current
  }
}

function WorkspaceDrawerChangedFolderNode({
  depth,
  expandedPaths,
  node,
  onOpenFile,
  onSelectFolder,
  onToggleFolder,
  selectedFilePath,
  selectedFolder,
  scope
}: {
  depth: number
  expandedPaths: Set<string>
  node: ChangedFolderNode
  onOpenFile?: (path: string) => void
  onSelectFolder: (path: string) => void
  onToggleFolder: (path: string) => void
  selectedFilePath?: string | null
  selectedFolder: SelectedChangedFolder | null
  scope: ChangedFileScope
}) {
  const isRoot = node.path === ''
  const compactFolder = isRoot ? { label: '', node } : getCompactFolderNode(node)
  const displayNode = compactFolder.node
  const isExpanded = isRoot || expandedPaths.has(displayNode.path)
  const isSelected = selectedFolder?.scope === scope && selectedFolder.path === displayNode.path

  return (
    <div className='chat-workspace-drawer__changed-folder-node'>
      {!isRoot && (
        <button
          type='button'
          className={`chat-workspace-drawer__changed-folder ${isExpanded ? 'is-expanded' : ''} ${
            isSelected ? 'is-selected' : ''
          }`}
          style={getFolderDepthStyle(depth)}
          aria-expanded={isExpanded}
          aria-pressed={isSelected}
          title={displayNode.path}
          onClick={() => {
            onSelectFolder(displayNode.path)
            onToggleFolder(displayNode.path)
          }}
        >
          <span className='material-symbols-rounded chat-workspace-drawer__changed-folder-icon'>
            {isExpanded ? 'folder_open' : 'folder'}
          </span>
          <span className='chat-workspace-drawer__changed-folder-name'>{compactFolder.label}</span>
        </button>
      )}
      <div
        className={`chat-workspace-drawer__changed-folder-children ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
      >
        <div className='chat-workspace-drawer__changed-folder-children-inner'>
          {displayNode.children.map(child => (
            <WorkspaceDrawerChangedFolderNode
              key={child.path}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              node={child}
              selectedFilePath={selectedFilePath}
              onOpenFile={onOpenFile}
              onSelectFolder={onSelectFolder}
              onToggleFolder={onToggleFolder}
              selectedFolder={selectedFolder}
              scope={scope}
            />
          ))}
          {displayNode.entries.map(entry => (
            <div
              key={entry.key}
              className='chat-workspace-drawer__changed-folder-entry'
              style={getFolderDepthStyle(displayNode.path === '' ? 0 : depth + 1)}
            >
              <WorkspaceDrawerChangedFileRow
                entry={entry}
                selectedFilePath={selectedFilePath}
                showDirectory={false}
                onOpenFile={onOpenFile}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function WorkspaceDrawerChangedFolderTree({
  command,
  onOpenFile,
  onSelectFolder,
  root,
  scope,
  selectedFilePath,
  selectedFolder
}: {
  command: ChangedTreeCommand | null
  onOpenFile?: (path: string) => void
  onSelectFolder: (folder: SelectedChangedFolder) => void
  root: ChangedFolderNode
  scope: ChangedFileScope
  selectedFilePath?: string | null
  selectedFolder: SelectedChangedFolder | null
}) {
  const allFolderPaths = useMemo(() => collectChangedFolderPaths(root), [root])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(allFolderPaths))

  useEffect(() => {
    setExpandedPaths(new Set(allFolderPaths))
  }, [allFolderPaths])

  useEffect(() => {
    if (command == null) {
      return
    }

    const targetPath = selectedFolder?.scope === scope ? selectedFolder.path : null
    const targetNode = targetPath == null ? root : findChangedFolderNode(root, targetPath)
    const targetPaths = targetNode == null ? allFolderPaths : collectChangedFolderPaths(targetNode)
    const paths = targetPath == null ? targetPaths : [targetPath, ...targetPaths]

    setExpandedPaths((prev) => {
      if (command.action === 'expand') {
        return new Set([...prev, ...paths])
      }
      const next = new Set(prev)
      for (const path of paths) {
        next.delete(path)
      }
      return next
    })
  }, [allFolderPaths, command, root, scope, selectedFolder])

  const handleToggleFolder = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  return (
    <WorkspaceDrawerChangedFolderNode
      depth={0}
      expandedPaths={expandedPaths}
      node={root}
      selectedFilePath={selectedFilePath}
      onOpenFile={onOpenFile}
      onSelectFolder={path => onSelectFolder({ scope, path })}
      onToggleFolder={handleToggleFolder}
      selectedFolder={selectedFolder}
      scope={scope}
    />
  )
}
