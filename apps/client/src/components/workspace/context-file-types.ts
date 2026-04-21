import type { WorkspaceTreeEntry } from '#~/api'

export interface ContextPickerFile {
  path: string
  name?: string
  size?: number
}

export interface ContextReferenceRequest {
  id: number
  files: ContextPickerFile[]
}

type ContextPickerFileEntry = Pick<ContextPickerFile, 'name' | 'path'>

export const getContextFileName = (path: string) => path.split(/[\\/]/).filter(Boolean).at(-1) ?? path

export const toContextPickerFile = (
  entry: ContextPickerFileEntry | Pick<WorkspaceTreeEntry, 'name' | 'path'>
): ContextPickerFile => ({
  path: entry.path,
  name: entry.name || getContextFileName(entry.path)
})

export const toContextPickerFiles = (
  paths: string[],
  entries: Array<ContextPickerFileEntry | Pick<WorkspaceTreeEntry, 'name' | 'path'>>
): ContextPickerFile[] => {
  const entryByPath = new Map(entries.map(entry => [entry.path, entry]))
  return paths.map((path) => {
    const entry = entryByPath.get(path)
    return entry == null
      ? { path, name: getContextFileName(path) }
      : toContextPickerFile(entry)
  })
}
