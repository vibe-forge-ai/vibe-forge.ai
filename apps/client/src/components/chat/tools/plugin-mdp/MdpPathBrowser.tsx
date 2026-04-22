import '../../../workspace/project-file-tree/ProjectFileTree.scss'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { MdpPathSummary } from '@vibe-forge/types'

import { ProjectFileTreeRows } from '#~/components/workspace/project-file-tree/ProjectFileTreeRows'
import type {
  ProjectFileTreeNode,
  ProjectFileTreeSelectionAdjacency
} from '#~/components/workspace/project-file-tree/project-file-tree-types'

type MdpPathTreeDetail = {
  path: string
  name: string
  type: 'file' | 'directory'
  description?: string
  methods?: string[]
  pathType?: string
  childCount?: number
  descendantPathCount?: number
  descendantDirectoryCount?: number
}

type MdpPathTreeModel = {
  detailsByPath: Map<string, MdpPathTreeDetail>
  nodes: ProjectFileTreeNode[]
}

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim() !== ''
)

const normalizeMdpPath = (path: string) => {
  const trimmedPath = path.trim()
  if (trimmedPath === '') {
    return ''
  }

  const normalizedPath = trimmedPath
    .replaceAll(/\/+/g, '/')
    .replace(/\/$/, '')

  if (normalizedPath === '') {
    return '/'
  }

  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
}

const getAncestorPaths = (path: string) => {
  const segments = path.split('/').filter(Boolean)
  return segments.slice(0, -1).map((_, index) => `/${segments.slice(0, index + 1).join('/')}`)
}

const sortTreeNodes = (nodes: ProjectFileTreeNode[]): ProjectFileTreeNode[] => (
  [...nodes]
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'directory' ? -1 : 1
      }
      return left.name.localeCompare(right.name)
    })
    .map((node) => ({
      ...node,
      ...(node.children != null ? { children: sortTreeNodes(node.children) } : {})
    }))
)

const finalizeDirectoryDetails = (
  nodes: ProjectFileTreeNode[],
  detailsByPath: Map<string, MdpPathTreeDetail>
): { directoryCount: number, pathCount: number } => {
  let directoryCount = 0
  let pathCount = 0

  for (const node of nodes) {
    if (node.type === 'directory') {
      directoryCount += 1
      const childNodes = node.children ?? []
      const nestedSummary = finalizeDirectoryDetails(childNodes, detailsByPath)
      const detail = detailsByPath.get(node.path)
      if (detail != null) {
        detail.childCount = childNodes.length
        detail.descendantDirectoryCount = nestedSummary.directoryCount
        detail.descendantPathCount = nestedSummary.pathCount
      }
      directoryCount += nestedSummary.directoryCount
      pathCount += nestedSummary.pathCount
      continue
    }

    pathCount += 1
  }

  return { directoryCount, pathCount }
}

const mergePathMetadata = (
  detail: MdpPathTreeDetail,
  pathRecord: MdpPathSummary
) => {
  if (isNonEmptyString(pathRecord.description)) {
    detail.description = pathRecord.description
  }
  if (Array.isArray(pathRecord.methods) && pathRecord.methods.length > 0) {
    detail.methods = pathRecord.methods
  }
  if (isNonEmptyString(pathRecord.type)) {
    detail.pathType = pathRecord.type
  }
}

export const buildMdpPathTreeModel = (paths: MdpPathSummary[]): MdpPathTreeModel => {
  const root: ProjectFileTreeNode[] = []
  const directoryLookup = new Map<string, ProjectFileTreeNode>()
  const detailsByPath = new Map<string, MdpPathTreeDetail>()
  const fileLookup = new Map<string, ProjectFileTreeNode>()
  const filePathSet = new Set<string>()

  for (const pathRecord of paths) {
    const normalizedPath = normalizeMdpPath(pathRecord.path)
    if (normalizedPath === '' || normalizedPath === '/') {
      continue
    }
    if (filePathSet.has(normalizedPath)) {
      continue
    }
    filePathSet.add(normalizedPath)

    const segments = normalizedPath.split('/').filter(Boolean)
    if (segments.length === 0) {
      continue
    }

    let currentChildren = root
    let currentPath = ''

    for (const [index, segment] of segments.entries()) {
      currentPath = `${currentPath}/${segment}`
      const isLeaf = index === segments.length - 1

      if (isLeaf) {
        const existingDirectory = directoryLookup.get(currentPath)
        if (existingDirectory != null) {
          const detail = detailsByPath.get(currentPath)
          if (detail != null) {
            mergePathMetadata(detail, pathRecord)
          }
          continue
        }

        const existingFile = fileLookup.get(currentPath)
        if (existingFile != null) {
          const detail = detailsByPath.get(currentPath)
          if (detail != null) {
            mergePathMetadata(detail, pathRecord)
          }
          continue
        }

        const fileNode = {
          name: segment,
          path: currentPath,
          type: 'file'
        } satisfies ProjectFileTreeNode

        currentChildren.push(fileNode)
        fileLookup.set(currentPath, fileNode)
        const detail = {
          path: currentPath,
          name: segment,
          type: 'file'
        } satisfies MdpPathTreeDetail
        mergePathMetadata(detail, pathRecord)
        detailsByPath.set(currentPath, detail)
        continue
      }

      let directory = directoryLookup.get(currentPath)
      if (directory == null) {
        const existingFile = fileLookup.get(currentPath)
        directory = {
          name: segment,
          path: currentPath,
          type: 'directory',
          children: []
        }
        directoryLookup.set(currentPath, directory)
        if (existingFile != null) {
          const existingIndex = currentChildren.findIndex(node => node.path === currentPath && node.type === 'file')
          if (existingIndex >= 0) {
            currentChildren.splice(existingIndex, 1, directory)
          } else {
            currentChildren.push(directory)
          }
          fileLookup.delete(currentPath)
          const detail = detailsByPath.get(currentPath) ?? {
            path: currentPath,
            name: segment,
            type: 'directory'
          }
          detail.type = 'directory'
          detailsByPath.set(currentPath, detail)
        } else {
          currentChildren.push(directory)
          detailsByPath.set(currentPath, {
            path: currentPath,
            name: segment,
            type: 'directory'
          })
        }
      }

      currentChildren = directory.children ?? []
    }
  }

  const nodes = sortTreeNodes(root)
  finalizeDirectoryDetails(nodes, detailsByPath)
  return { detailsByPath, nodes }
}

const getFirstLeafPath = (nodes: ProjectFileTreeNode[]): string | null => {
  let firstDirectoryPath: string | null = null

  for (const node of nodes) {
    if (node.type === 'file') {
      return node.path
    }
    firstDirectoryPath ??= node.path
    const childPath = node.children == null ? null : getFirstLeafPath(node.children)
    if (childPath != null) {
      return childPath
    }
  }
  return firstDirectoryPath
}

export function MdpPathBrowser({
  paths
}: {
  paths: MdpPathSummary[]
}) {
  const { t } = useTranslation()
  const { detailsByPath, nodes } = useMemo(() => buildMdpPathTreeModel(paths), [paths])
  const initialSelectedPath = useMemo(() => getFirstLeafPath(nodes), [nodes])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set())
  const [selectedPath, setSelectedPath] = useState<string | null>(initialSelectedPath)

  useEffect(() => {
    setSelectedPath(initialSelectedPath)
    if (initialSelectedPath == null) {
      setExpandedPaths(new Set())
      return
    }

    const nextExpandedPaths = new Set<string>()
    for (const node of nodes) {
      if (node.type === 'directory') {
        nextExpandedPaths.add(node.path)
      }
    }
    for (const ancestorPath of getAncestorPaths(initialSelectedPath)) {
      nextExpandedPaths.add(ancestorPath)
    }
    setExpandedPaths(nextExpandedPaths)
  }, [initialSelectedPath, nodes])

  const selectedPathSet = useMemo(() => (
    selectedPath == null ? new Set<string>() : new Set([selectedPath])
  ), [selectedPath])
  const selectedAdjacencyByPath = useMemo(() => {
    const adjacency = new Map<string, ProjectFileTreeSelectionAdjacency>()
    if (selectedPath != null) {
      adjacency.set(selectedPath, {
        hasSelectedAfter: false,
        hasSelectedBefore: false
      })
    }
    return adjacency
  }, [selectedPath])
  const loadingPaths = useMemo(() => new Set<string>(), [])
  const selectedDetail = selectedPath == null ? null : detailsByPath.get(selectedPath) ?? null

  if (nodes.length === 0) {
    return (
      <div className='mdp-tool__empty'>
        {t('chat.tools.mdp.emptyPaths', { defaultValue: 'No paths returned.' })}
      </div>
    )
  }

  return (
    <div className='mdp-tool__path-browser'>
      <div className='mdp-tool__path-browser-pane mdp-tool__path-browser-pane--tree'>
        <div className='project-file-tree mdp-tool__path-tree'>
          <ProjectFileTreeRows
            depth={0}
            expandedPaths={expandedPaths}
            loadingPaths={loadingPaths}
            nodes={nodes}
            referenceNodes={[]}
            selectableTypes='all'
            selectedAdjacencyByPath={selectedAdjacencyByPath}
            selectedPathSet={selectedPathSet}
            showContextMenu={false}
            onContextSelect={() => {}}
            onSelectNode={(node) => {
              setSelectedPath(node.path)
              return node.type === 'file'
            }}
            onToggleDirectory={(node) => {
              setSelectedPath(node.path)
              setExpandedPaths((current) => {
                const next = new Set(current)
                if (next.has(node.path)) {
                  next.delete(node.path)
                } else {
                  next.add(node.path)
                }
                return next
              })
            }}
          />
        </div>
      </div>

      <div className='mdp-tool__path-browser-pane mdp-tool__path-browser-pane--detail'>
        {selectedDetail == null
          ? (
            <div className='mdp-tool__empty'>
              {t('chat.tools.mdp.pathDetailEmpty', { defaultValue: 'Select a path to inspect its details.' })}
            </div>
          )
          : (
            <div className='mdp-tool__path-detail'>
              <code className='mdp-tool__path-detail-path'>{selectedDetail.path}</code>

              {selectedDetail.type === 'directory'
                ? (
                  <div className='mdp-tool__path-detail-grid'>
                    {isNonEmptyString(selectedDetail.description) && (
                      <div className='mdp-tool__path-detail-description'>{selectedDetail.description}</div>
                    )}
                    {isNonEmptyString(selectedDetail.pathType) && (
                      <div className='mdp-tool__kv-row'>
                        <span className='mdp-tool__kv-label'>
                          {t('chat.tools.mdp.pathType', { defaultValue: 'Type' })}
                        </span>
                        <span className='mdp-tool__kv-value'>{selectedDetail.pathType}</span>
                      </div>
                    )}
                    {selectedDetail.methods != null && selectedDetail.methods.length > 0 && (
                      <div className='mdp-tool__path-detail-methods'>
                        <span className='mdp-tool__kv-label'>
                          {t('chat.tools.mdp.methods', { defaultValue: 'Methods' })}
                        </span>
                        <div className='mdp-tool__path-badges'>
                          {selectedDetail.methods.map((method) => (
                            <span className='mdp-tool__badge mdp-tool__badge--method' key={method}>
                              {method}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className='mdp-tool__kv-row'>
                      <span className='mdp-tool__kv-label'>
                        {t('chat.tools.mdp.childEntries', { defaultValue: 'Child entries' })}
                      </span>
                      <span className='mdp-tool__kv-value'>{selectedDetail.childCount ?? 0}</span>
                    </div>
                    <div className='mdp-tool__kv-row'>
                      <span className='mdp-tool__kv-label'>
                        {t('chat.tools.mdp.descendantPaths', { defaultValue: 'Nested paths' })}
                      </span>
                      <span className='mdp-tool__kv-value'>{selectedDetail.descendantPathCount ?? 0}</span>
                    </div>
                    <div className='mdp-tool__kv-row'>
                      <span className='mdp-tool__kv-label'>
                        {t('chat.tools.mdp.descendantDirectories', { defaultValue: 'Nested directories' })}
                      </span>
                      <span className='mdp-tool__kv-value'>{selectedDetail.descendantDirectoryCount ?? 0}</span>
                    </div>
                    <div className='mdp-tool__path-detail-description'>
                      {t('chat.tools.mdp.directoryDetailHint', {
                        defaultValue: 'This node groups the nested MDP paths under the selected prefix.'
                      })}
                    </div>
                  </div>
                )
                : (
                  <div className='mdp-tool__path-detail-grid'>
                    {isNonEmptyString(selectedDetail.description) && (
                      <div className='mdp-tool__path-detail-description'>{selectedDetail.description}</div>
                    )}
                    {isNonEmptyString(selectedDetail.pathType) && (
                      <div className='mdp-tool__kv-row'>
                        <span className='mdp-tool__kv-label'>
                          {t('chat.tools.mdp.pathType', { defaultValue: 'Type' })}
                        </span>
                        <span className='mdp-tool__kv-value'>{selectedDetail.pathType}</span>
                      </div>
                    )}
                    {selectedDetail.methods != null && selectedDetail.methods.length > 0 && (
                      <div className='mdp-tool__path-detail-methods'>
                        <span className='mdp-tool__kv-label'>
                          {t('chat.tools.mdp.methods', { defaultValue: 'Methods' })}
                        </span>
                        <div className='mdp-tool__path-badges'>
                          {selectedDetail.methods.map((method) => (
                            <span className='mdp-tool__badge mdp-tool__badge--method' key={method}>
                              {method}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {!isNonEmptyString(selectedDetail.description) &&
                      !isNonEmptyString(selectedDetail.pathType) &&
                      (selectedDetail.methods == null || selectedDetail.methods.length === 0) && (
                        <div className='mdp-tool__empty'>
                          {t('chat.tools.mdp.pathDetailUnavailable', {
                            defaultValue: 'This path did not return extra description metadata.'
                          })}
                        </div>
                      )}
                  </div>
                )}
            </div>
          )}
      </div>
    </div>
  )
}
