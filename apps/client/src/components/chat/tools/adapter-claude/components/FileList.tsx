import React, { useEffect, useMemo, useState } from 'react'
import './FileList.scss'

interface FileNode {
  rawLine: string
  name: string
  path: string
  depth: number
  isDir: boolean
}

interface FileListProps {
  content: string | string[]
  removeRoot?: boolean
  defaultCollapsed?: boolean
}

export function FileList({ content, removeRoot = false, defaultCollapsed = false }: FileListProps) {
  const nodes = useMemo(() => {
    let lines: string[] = []
    if (Array.isArray(content)) {
      lines = content
    } else if (typeof content === 'string') {
      if (content.trim().startsWith('[') && content.trim().endsWith(']')) {
        try {
          const parsed = JSON.parse(content)
          if (Array.isArray(parsed)) {
            lines = parsed.map(String)
          } else {
            lines = content.split('\n')
          }
        } catch (e) {
          lines = content.split('\n')
        }
      } else {
        lines = content.split('\n')
      }
    }

    lines = lines.filter(line => line.trim() !== '')

    let parsedNodes: FileNode[] = []

    lines.forEach(line => {
      const leadingSpaces = line.match(/^\s*/)?.[0].length || 0
      const depth = Math.floor(leadingSpaces / 2)

      let name = line.trim()
      if (name.startsWith('- ')) {
        name = name.substring(2)
      }

      const isDir = name.endsWith('/') || name.endsWith('\\')

      parsedNodes.push({
        rawLine: line,
        name,
        path: name,
        depth,
        isDir
      })
    })

    if (removeRoot && parsedNodes.length > 1 && parsedNodes[0].isDir) {
      if (parsedNodes[1].depth > parsedNodes[0].depth) {
        const rootDepth = parsedNodes[0].depth
        parsedNodes.shift()
        const minDepth = Math.min(...parsedNodes.map(n => n.depth))
        parsedNodes = parsedNodes.map(n => ({
          ...n,
          depth: n.depth - minDepth
        }))
      }
    }

    return parsedNodes
  }, [content, removeRoot])

  const [collapsedIndices, setCollapsedIndices] = useState<Set<number>>(new Set())

  const hasDirectories = useMemo(() => {
    return nodes.some(node => node.isDir)
  }, [nodes])

  useEffect(() => {
    if (defaultCollapsed) {
      const newSet = new Set<number>()
      nodes.forEach((node, index) => {
        if (node.isDir) {
          newSet.add(index)
        }
      })
      setCollapsedIndices(newSet)
    } else {
      setCollapsedIndices(new Set())
    }
  }, [nodes, defaultCollapsed])

  const toggleCollapse = (index: number) => {
    const newSet = new Set(collapsedIndices)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setCollapsedIndices(newSet)
  }

  if (nodes.length === 0) {
    return <div className='file-list-empty'>No files found</div>
  }

  const getIcon = (node: FileNode) => {
    if (node.isDir) {
      return { name: 'folder', className: 'folder' }
    }

    const ext = node.name.split('.').pop()?.toLowerCase()
    if (ext && ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'c', 'cpp', 'go', 'rs'].includes(ext)) {
      return { name: 'code', className: 'file' }
    }
    if (ext && ['md', 'txt', 'json', 'yml', 'yaml', 'xml', 'html', 'css', 'scss'].includes(ext)) {
      return { name: 'description', className: 'file' }
    }
    if (ext && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico'].includes(ext)) {
      return { name: 'image', className: 'file' }
    }

    return { name: 'draft', className: 'file' }
  }

  const renderNodes = () => {
    const elements: React.ReactNode[] = []
    let hideDepth: number | null = null

    nodes.forEach((node, index) => {
      if (hideDepth !== null) {
        if (node.depth > hideDepth) {
          return
        } else {
          hideDepth = null
        }
      }

      const icon = getIcon(node)
      const isCollapsed = collapsedIndices.has(index)

      if (isCollapsed) {
        hideDepth = node.depth
      }

      elements.push(
        <div
          key={index}
          className={`file-list-item ${node.isDir ? 'is-dir' : ''}`}
          style={{ paddingLeft: `${node.depth * 20 + 12}px` }}
          onClick={() => node.isDir && toggleCollapse(index)}
        >
          {hasDirectories && (
            <>
              {node.isDir && (
                <span className='material-symbols-rounded toggle-icon'>
                  {isCollapsed ? 'arrow_right' : 'arrow_drop_down'}
                </span>
              )}
              {!node.isDir && <span className='spacer' />}
            </>
          )}

          <span className={`material-symbols-rounded file-icon ${icon.className}`}>
            {icon.name}
          </span>
          <span className='file-path'>{node.name}</span>
        </div>
      )
    })
    return elements
  }

  return (
    <div className='file-list-container'>
      {renderNodes()}
    </div>
  )
}
