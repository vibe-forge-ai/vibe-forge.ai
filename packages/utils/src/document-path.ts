import { basename, dirname, relative } from 'node:path'

const stripExtension = (fileName: string) => fileName.replace(/\.[^/.]+$/, '')

export const normalizePath = (value: string) => value.split('\\').join('/')

export const resolveRelativePath = (cwd: string, value: string) => (
  normalizePath(relative(cwd, value))
)

export const resolvePromptPath = (cwd: string, value: string) => {
  const relativePath = resolveRelativePath(cwd, value)
  return relativePath.startsWith('..') ? normalizePath(value) : relativePath
}

export const resolveDocumentName = (
  path: string,
  explicitName?: string,
  indexFileNames: string[] = []
) => {
  const trimmedName = explicitName?.trim()
  if (trimmedName) return trimmedName

  const fileName = basename(path).toLowerCase()
  if (indexFileNames.includes(fileName)) {
    return basename(dirname(path))
  }

  return stripExtension(basename(path))
}

export const resolveSpecIdentifier = (path: string, explicitName?: string) => (
  resolveDocumentName(path, explicitName, ['index.md'])
)
