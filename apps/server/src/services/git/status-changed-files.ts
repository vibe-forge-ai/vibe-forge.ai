import type { GitChangedFile } from '@vibe-forge/types'

const mergeSubmoduleChange = (
  left: GitChangedFile['submodule'],
  right: GitChangedFile['submodule']
): GitChangedFile['submodule'] => {
  if (left == null) {
    return right
  }
  if (right == null) {
    return left
  }
  return {
    commitChanged: left.commitChanged || right.commitChanged,
    trackedChanges: left.trackedChanges || right.trackedChanges,
    untrackedChanges: left.untrackedChanges || right.untrackedChanges
  }
}

export const setGitStatusChangedFile = (
  changedFilesByPath: Map<string, GitChangedFile>,
  path: string,
  patch: Pick<GitChangedFile, 'staged' | 'unstaged' | 'untracked'> & Pick<Partial<GitChangedFile>, 'submodule'>
) => {
  const normalizedPath = path.trim()
  if (normalizedPath === '') {
    return
  }

  const existing = changedFilesByPath.get(normalizedPath) ?? {
    path: normalizedPath,
    staged: false,
    unstaged: false,
    untracked: false
  }

  const submodule = mergeSubmoduleChange(existing.submodule, patch.submodule)
  changedFilesByPath.set(normalizedPath, {
    path: normalizedPath,
    staged: existing.staged || patch.staged,
    unstaged: existing.unstaged || patch.unstaged,
    untracked: existing.untracked || patch.untracked,
    ...(submodule != null ? { submodule } : {})
  })
}

const getRestAfterFields = (line: string, fieldCount: number) => {
  let index = 0
  let fieldsRead = 0

  while (fieldsRead < fieldCount && index < line.length) {
    while (index < line.length && (line[index] ?? '').trim() === '') {
      index += 1
    }
    while (index < line.length && (line[index] ?? '').trim() !== '') {
      index += 1
    }
    fieldsRead += 1
  }

  while (index < line.length && (line[index] ?? '').trim() === '') {
    index += 1
  }

  return line.slice(index)
}

export const parseGitStatusChangedPath = (line: string) => {
  if (line.startsWith('? ')) {
    return line.slice(2).trim()
  }

  if (line.startsWith('1 ')) {
    return getRestAfterFields(line, 8).trim()
  }

  if (line.startsWith('2 ')) {
    return getRestAfterFields(line, 9).split('\t')[0]?.trim() ?? ''
  }

  if (line.startsWith('u ')) {
    return getRestAfterFields(line, 10).trim()
  }

  return ''
}

export const parseGitStatusSubmoduleChange = (value: string): GitChangedFile['submodule'] => {
  if (!value.startsWith('S')) {
    return undefined
  }

  return {
    commitChanged: (value.at(1) ?? '.') !== '.',
    trackedChanges: (value.at(2) ?? '.') !== '.',
    untrackedChanges: (value.at(3) ?? '.') !== '.'
  }
}
