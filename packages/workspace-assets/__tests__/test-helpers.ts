import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach } from 'vitest'

const tempDirs: string[] = []

export const createWorkspace = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workspace-assets-'))
  tempDirs.push(dir)
  return dir
}

export const writeDocument = async (filePath: string, content: string) => {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content)
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})
