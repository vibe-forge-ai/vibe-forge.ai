import { Tooltip } from 'antd'
import type { TFunction } from 'i18next'
import type { CSSProperties, MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ProjectFileTreeRowContextMenu } from './ProjectFileTreeRowContextMenu'
import { getProjectLinkIndicatorIconMeta } from './project-file-tree-icons'
import type { ProjectFileTreeIconMeta } from './project-file-tree-icons'
import type { ProjectFileTreeNode } from './project-file-tree-types'

const getTreeRowStyle = (depth: number): CSSProperties => ({
  '--project-tree-depth': depth
} as CSSProperties)

const getTreeNodeTitle = (node: ProjectFileTreeNode, t: TFunction) => {
  const linkKind = node.linkKind ?? (node.isSymlink === true ? 'symlink' : undefined)
  if (linkKind == null) {
    return node.path
  }

  const target = node.linkTarget == null ? t('chat.workspaceTreeTargetMissing') : node.linkTarget
  const state = node.linkType === 'missing'
    ? t('chat.workspaceTreeTargetMissingState')
    : node.isExternal === true
    ? t('chat.workspaceTreeExternalLinkState')
    : ''
  return t('chat.workspaceTreeNodeLinkTitle', { path: node.path, target, state })
}

const getLinkIndicatorTitle = (node: ProjectFileTreeNode, t: TFunction) => {
  const target = node.linkTarget == null || node.linkTarget === ''
    ? t('chat.workspaceTreeTargetMissing')
    : node.linkTarget
  if (node.linkType === 'missing') {
    return t('chat.workspaceTreeLinkTargetMissing', { target })
  }
  if (node.isExternal === true) {
    return target
  }
  return t('chat.workspaceTreeLinkTarget', { target })
}

const renderTreeIcon = (icon: ProjectFileTreeIconMeta) => (
  <span className={`project-file-tree__icon-wrap is-${icon.tone}`}>
    <span className={`material-symbols-rounded project-file-tree__icon is-${icon.tone}`}>
      {icon.icon}
    </span>
    {icon.badgeIcon != null && (
      <span className={`material-symbols-rounded project-file-tree__icon-badge is-${icon.tone}`}>
        {icon.badgeIcon}
      </span>
    )}
  </span>
)

const renderLinkIndicator = (node: ProjectFileTreeNode, linkKind: 'gitdir' | 'symlink', t: TFunction) => {
  const icon = getProjectLinkIndicatorIconMeta(linkKind, node.linkType, node.isExternal)
  return (
    <Tooltip destroyOnHidden placement='left' title={getLinkIndicatorTitle(node, t)}>
      <span className={`material-symbols-rounded project-file-tree__link-indicator is-${icon.tone}`}>
        {icon.icon}
      </span>
    </Tooltip>
  )
}

export function ProjectFileTreeRow({
  canOpenFile,
  canReference,
  canToggleDirectory,
  depth,
  hasSelectedAfter,
  hasSelectedBefore,
  icon,
  isDirectory,
  isExpanded,
  isLinkedNode,
  isSelected,
  linkKind,
  node,
  referenceNodes,
  showContextMenu,
  onContextSelect,
  onOpenFile,
  onReferenceNodes,
  onSelectNode,
  onToggleDirectory
}: {
  canOpenFile: boolean
  canReference: boolean
  canToggleDirectory: boolean
  depth: number
  hasSelectedAfter: boolean
  hasSelectedBefore: boolean
  icon: ProjectFileTreeIconMeta
  isDirectory: boolean
  isExpanded: boolean
  isLinkedNode: boolean
  isSelected: boolean
  linkKind?: 'gitdir' | 'symlink'
  node: ProjectFileTreeNode
  referenceNodes: ProjectFileTreeNode[]
  showContextMenu: boolean
  onContextSelect: (node: ProjectFileTreeNode) => void
  onOpenFile?: (path: string) => void
  onReferenceNodes?: (nodes: ProjectFileTreeNode[]) => void
  onSelectNode: (node: ProjectFileTreeNode, event: MouseEvent<HTMLButtonElement>) => boolean
  onToggleDirectory: (node: ProjectFileTreeNode) => void
}) {
  const { t } = useTranslation()
  const isActionEnabled = isDirectory ? canToggleDirectory : canOpenFile || canReference
  const rowTypeClass = isDirectory ? 'is-directory' : 'is-file'
  const row = (
    <button
      type='button'
      className={`project-file-tree__row ${rowTypeClass} ${isExpanded ? 'is-expanded' : ''} ${
        isLinkedNode ? 'is-symlink' : ''
      } ${isSelected ? 'is-selected' : ''} ${hasSelectedBefore ? 'has-selected-before' : ''} ${
        hasSelectedAfter ? 'has-selected-after' : ''
      } ${isActionEnabled ? '' : 'is-disabled'}`}
      aria-disabled={!isActionEnabled}
      aria-label={getTreeNodeTitle(node, t)}
      data-workspace-tree-path={node.path}
      style={getTreeRowStyle(depth)}
      tabIndex={isActionEnabled ? undefined : -1}
      title={isLinkedNode ? undefined : node.path}
      onContextMenu={() => onContextSelect(node)}
      onClick={(event) => {
        const handledBySelection = onSelectNode(node, event)
        if (handledBySelection) {
          return
        }

        if (isDirectory && canToggleDirectory) {
          onToggleDirectory(node)
        } else if (!isDirectory && canOpenFile) {
          onOpenFile?.(node.path)
        }
      }}
    >
      {renderTreeIcon(icon)}
      <span className='project-file-tree__name'>{node.name}</span>
      {linkKind != null && renderLinkIndicator(node, linkKind, t)}
    </button>
  )

  if (!showContextMenu) {
    return row
  }

  return (
    <ProjectFileTreeRowContextMenu
      canOpenFile={canOpenFile}
      canReference={canReference}
      canToggleDirectory={canToggleDirectory}
      isDirectory={isDirectory}
      isExpanded={isExpanded}
      node={node}
      referenceNodes={referenceNodes}
      onOpenFile={onOpenFile}
      onReferenceNodes={onReferenceNodes}
      onToggleDirectory={onToggleDirectory}
    >
      {row}
    </ProjectFileTreeRowContextMenu>
  )
}
