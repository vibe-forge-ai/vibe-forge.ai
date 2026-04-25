const { lstatSync, mkdirSync, readdirSync, statSync, symlinkSync } = require('node:fs')
const path = require('node:path')
const process = require('node:process')

const GIT_HOME_ENTRIES = [
  '.git-credentials',
  '.git-credential',
  '.git-credential-cache',
  path.join('.config', 'git')
]

const normalizeHome = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed ? path.resolve(trimmed) : undefined
}

const pathExistsOrSymlink = (targetPath) => {
  try {
    lstatSync(targetPath)
    return true
  } catch {
    return false
  }
}

const resolveSymlinkType = (sourcePath) => {
  try {
    const stat = statSync(sourcePath)
    if (stat.isDirectory()) {
      return process.platform === 'win32' ? 'junction' : 'dir'
    }
  } catch {}

  return 'file'
}

const collectGitHomeEntries = (realHome) => {
  const entries = new Set(GIT_HOME_ENTRIES)

  try {
    for (const entry of readdirSync(realHome)) {
      if (entry.startsWith('.gitconfig')) {
        entries.add(entry)
      }
    }
  } catch {}

  return [...entries]
}

const linkRealHomeGitConfig = (options = {}) => {
  const realHome = normalizeHome(options.realHome ?? process.env.__VF_PROJECT_REAL_HOME__)
  const mockHome = normalizeHome(options.mockHome ?? process.env.HOME)

  if (realHome == null || mockHome == null || realHome === mockHome) {
    return
  }

  for (const entry of collectGitHomeEntries(realHome)) {
    const sourcePath = path.join(realHome, entry)
    const targetPath = path.join(mockHome, entry)

    try {
      if (!pathExistsOrSymlink(sourcePath) || pathExistsOrSymlink(targetPath)) {
        continue
      }

      mkdirSync(path.dirname(targetPath), { recursive: true })
      symlinkSync(sourcePath, targetPath, resolveSymlinkType(sourcePath))
    } catch {}
  }
}

module.exports = {
  linkRealHomeGitConfig
}
