import { access, lstat, mkdir, readlink, rm, stat, symlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

export type ManagedSymlinkType = 'dir' | 'file' | 'junction'

export type SyncSymlinkTargetResult = 'linked' | 'removed' | 'skipped' | 'unchanged'

const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const hasExpectedSymlinkTarget = async (params: {
  sourcePath: string
  targetPath: string
}) => {
  const { sourcePath, targetPath } = params

  try {
    const existing = await lstat(targetPath)
    if (!existing.isSymbolicLink()) return false

    return resolve(dirname(targetPath), await readlink(targetPath)) === resolve(sourcePath)
  } catch {
    return false
  }
}

const resolveManagedSymlinkType = async (
  sourcePath: string,
  type: ManagedSymlinkType | undefined
): Promise<ManagedSymlinkType> => {
  if (type != null) return type
  return (await stat(sourcePath)).isDirectory()
    ? process.platform === 'win32'
      ? 'junction'
      : 'dir'
    : 'file'
}

export const syncSymlinkTarget = async (params: {
  sourcePath: string
  targetPath: string
  type?: ManagedSymlinkType
  onMissingSource?: 'remove' | 'skip'
}): Promise<SyncSymlinkTargetResult> => {
  const {
    sourcePath,
    targetPath,
    type,
    onMissingSource = 'skip'
  } = params

  if (!await pathExists(sourcePath)) {
    if (onMissingSource === 'remove') {
      await rm(targetPath, { recursive: true, force: true })
      return 'removed'
    }
    return 'skipped'
  }

  if (resolve(sourcePath) === resolve(targetPath)) return 'unchanged'
  if (await hasExpectedSymlinkTarget({ sourcePath, targetPath })) return 'unchanged'

  await rm(targetPath, { recursive: true, force: true })
  await mkdir(dirname(targetPath), { recursive: true })

  try {
    await symlink(sourcePath, targetPath, await resolveManagedSymlinkType(sourcePath, type))
    return 'linked'
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === 'EEXIST' &&
      await hasExpectedSymlinkTarget({ sourcePath, targetPath })
    ) {
      return 'unchanged'
    }

    throw error
  }
}
