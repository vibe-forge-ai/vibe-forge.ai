import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HttpError } from '#~/utils/http.js'

import { readWorkspaceFile, updateWorkspaceFile } from '#~/services/workspace/file.js'

describe('workspace file service', () => {
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'vf-workspace-file-'))
    vi.stubEnv('__VF_PROJECT_WORKSPACE_FOLDER__', workspaceDir)

    await mkdir(join(workspaceDir, 'src'), { recursive: true })
    await writeFile(join(workspaceDir, 'src', 'index.ts'), 'export const value = 1\n')
    await writeFile(join(workspaceDir, 'binary.dat'), Buffer.from([0, 1, 2, 3]))
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(workspaceDir, { recursive: true, force: true })
  })

  it('reads UTF-8 files relative to the workspace root', async () => {
    await expect(readWorkspaceFile('src/index.ts')).resolves.toEqual({
      path: 'src/index.ts',
      content: 'export const value = 1\n',
      encoding: 'utf-8',
      size: 23
    })
  })

  it('updates an existing workspace file', async () => {
    await expect(updateWorkspaceFile('src/index.ts', 'export const value = 2\n')).resolves.toEqual({
      path: 'src/index.ts',
      content: 'export const value = 2\n',
      encoding: 'utf-8',
      size: 23
    })

    await expect(readFile(join(workspaceDir, 'src', 'index.ts'), 'utf8')).resolves.toBe('export const value = 2\n')
  })

  it('rejects paths outside the workspace root', async () => {
    await expect(readWorkspaceFile('../outside.ts')).rejects.toMatchObject(
      {
        status: 400,
        code: 'invalid_workspace_tree_path'
      } satisfies Partial<HttpError>
    )
  })

  it('rejects binary files', async () => {
    await expect(readWorkspaceFile('binary.dat')).rejects.toMatchObject(
      {
        status: 400,
        code: 'workspace_file_binary'
      } satisfies Partial<HttpError>
    )
  })

  it('rejects updating binary files', async () => {
    await expect(updateWorkspaceFile('binary.dat', 'text')).rejects.toMatchObject(
      {
        status: 400,
        code: 'workspace_file_binary'
      } satisfies Partial<HttpError>
    )
  })
})
