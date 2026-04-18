import type { GitChangedFile } from '@vibe-forge/types'

export type ChangedFilesLayout = 'folders' | 'flat'
export type ChangedFileScope = 'staged' | 'tracked' | 'untracked'
export type ChangedTreeCommandAction = 'expand' | 'collapse'

export interface ChangedTreeCommand {
  action: ChangedTreeCommandAction
  id: number
}

export interface ChangedFileEntry {
  file: GitChangedFile
  key: string
  scope: ChangedFileScope
}

export interface ChangedFileSection {
  count: number
  entries: ChangedFileEntry[]
  scope: ChangedFileScope
}

export interface ChangedFolderNode {
  children: ChangedFolderNode[]
  entries: ChangedFileEntry[]
  name: string
  path: string
}

export interface SelectedChangedFolder {
  path: string
  scope: ChangedFileScope
}

const sortEntries = (entries: ChangedFileEntry[]) =>
  [...entries].sort((left, right) => left.file.path.localeCompare(right.file.path))

export const getFileName = (path: string) => path.split('/').pop() ?? path

export const getFileDirectory = (path: string) => {
  const fileName = getFileName(path)
  return path === fileName ? '' : path.slice(0, Math.max(0, path.length - fileName.length - 1))
}

export const getChangedFileEntries = (file: GitChangedFile): ChangedFileEntry[] => {
  const entries: ChangedFileEntry[] = []

  if (file.staged) {
    entries.push({ file, key: `${file.path}:staged`, scope: 'staged' })
  }
  if (file.unstaged && !file.untracked) {
    entries.push({ file, key: `${file.path}:tracked`, scope: 'tracked' })
  }
  if (file.untracked) {
    entries.push({ file, key: `${file.path}:untracked`, scope: 'untracked' })
  }

  return entries
}

export const getChangedFileSections = (files: GitChangedFile[]): ChangedFileSection[] => {
  const entries = files.flatMap(getChangedFileEntries)
  const sections: ChangedFileSection[] = [
    { scope: 'staged', entries: [], count: 0 },
    { scope: 'tracked', entries: [], count: 0 },
    { scope: 'untracked', entries: [], count: 0 }
  ]

  for (const section of sections) {
    section.entries = sortEntries(entries.filter(entry => entry.scope === section.scope))
    section.count = section.entries.length
  }

  return sections.filter(section => section.count > 0)
}

const findOrCreateFolderNode = (parent: ChangedFolderNode, name: string, path: string) => {
  const existing = parent.children.find(child => child.path === path)
  if (existing != null) {
    return existing
  }

  const node: ChangedFolderNode = {
    name,
    path,
    children: [],
    entries: []
  }
  parent.children.push(node)
  return node
}

const sortFolderNode = (node: ChangedFolderNode) => {
  node.children.sort((left, right) => left.name.localeCompare(right.name))
  node.entries = sortEntries(node.entries)
  for (const child of node.children) {
    sortFolderNode(child)
  }
}

export const buildChangedFolderTree = (entries: ChangedFileEntry[]): ChangedFolderNode => {
  const root: ChangedFolderNode = {
    name: '',
    path: '',
    children: [],
    entries: []
  }

  for (const entry of entries) {
    const parts = entry.file.path.split('/').filter(Boolean)
    const fileName = parts.pop()
    if (fileName == null) {
      continue
    }

    let current = root
    let currentPath = ''
    for (const part of parts) {
      currentPath = currentPath === '' ? part : `${currentPath}/${part}`
      current = findOrCreateFolderNode(current, part, currentPath)
    }
    current.entries.push(entry)
  }

  sortFolderNode(root)
  return root
}

export const collectChangedFolderPaths = (node: ChangedFolderNode): string[] => {
  const paths = node.path === '' ? [] : [node.path]
  for (const child of node.children) {
    paths.push(...collectChangedFolderPaths(child))
  }
  return paths
}

export const findChangedFolderNode = (
  node: ChangedFolderNode,
  path: string
): ChangedFolderNode | null => {
  if (node.path === path) {
    return node
  }
  for (const child of node.children) {
    const found = findChangedFolderNode(child, path)
    if (found != null) {
      return found
    }
  }
  return null
}
