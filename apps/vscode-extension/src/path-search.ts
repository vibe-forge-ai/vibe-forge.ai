import { accessSync, constants } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const WINDOWS_EXTENSIONS = ['.cmd', '.exe', '.bat', '.ps1']

const splitPath = (value: string | undefined) => (
  typeof value === 'string'
    ? value.split(path.delimiter).filter(Boolean)
    : []
)

export const getWorkspaceBinDir = (workspacePath: string) => path.join(workspacePath, 'node_modules', '.bin')

export const createSearchPath = (
  workspacePath: string
) => [getWorkspaceBinDir(workspacePath), ...splitPath(process.env.PATH)]

export const createProcessPath = (workspacePath: string) => (
  createSearchPath(workspacePath).join(path.delimiter)
)

const isExecutable = (candidate: string) => {
  try {
    accessSync(candidate, constants.X_OK)
    return true
  } catch {
    return false
  }
}

const commandFileCandidates = (command: string) => {
  if (process.platform !== 'win32' || path.extname(command) !== '') {
    return [command]
  }
  return [command, ...WINDOWS_EXTENSIONS.map(extension => `${command}${extension}`)]
}

export const findExecutable = (command: string, searchPaths: string[]) => {
  const trimmed = command.trim()
  if (trimmed === '') {
    return undefined
  }

  if (path.isAbsolute(trimmed) || trimmed.includes(path.sep)) {
    return commandFileCandidates(trimmed).find(isExecutable)
  }

  for (const searchPath of searchPaths) {
    for (const candidate of commandFileCandidates(path.join(searchPath, trimmed))) {
      if (isExecutable(candidate)) {
        return candidate
      }
    }
  }

  return undefined
}
