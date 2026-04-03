import { relative } from 'node:path'

export const normalizePath = (value: string) => value.split('\\').join('/')

export const resolveRelativePath = (cwd: string, value: string) => (
  normalizePath(relative(cwd, value))
)

export const resolvePromptPath = (cwd: string, value: string) => {
  const relativePath = resolveRelativePath(cwd, value)
  return relativePath.startsWith('..') ? normalizePath(value) : relativePath
}
