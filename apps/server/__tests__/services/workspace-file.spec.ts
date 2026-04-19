import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HttpError } from '#~/utils/http.js'

import { readWorkspaceFile, resolveWorkspaceImageResource, updateWorkspaceFile } from '#~/services/workspace/file.js'

describe('workspace file service', () => {
  let externalDir: string
  let workspaceDir: string

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'vf-workspace-file-'))
    externalDir = await mkdtemp(join(tmpdir(), 'vf-workspace-file-external-'))
    vi.stubEnv('__VF_PROJECT_WORKSPACE_FOLDER__', workspaceDir)

    await mkdir(join(workspaceDir, 'src'), { recursive: true })
    await mkdir(join(workspaceDir, 'assets'), { recursive: true })
    await writeFile(join(workspaceDir, 'src', 'index.ts'), 'export const value = 1\n')
    await writeFile(join(workspaceDir, 'assets', 'logo.png'), Buffer.from([137, 80, 78, 71]))
    await writeFile(join(workspaceDir, 'binary.dat'), Buffer.from([0, 1, 2, 3]))
    await writeFile(join(externalDir, 'outside.ts'), 'export const outside = true\n')
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(workspaceDir, { recursive: true, force: true })
    await rm(externalDir, { recursive: true, force: true })
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

  it('reads and updates internal symbolic link files', async () => {
    await symlink('src/index.ts', join(workspaceDir, 'index-link.ts'), 'file')

    await expect(readWorkspaceFile('index-link.ts')).resolves.toEqual({
      path: 'index-link.ts',
      content: 'export const value = 1\n',
      encoding: 'utf-8',
      size: 23
    })

    await expect(updateWorkspaceFile('index-link.ts', 'export const value = 3\n')).resolves.toEqual({
      path: 'index-link.ts',
      content: 'export const value = 3\n',
      encoding: 'utf-8',
      size: 23
    })

    await expect(readFile(join(workspaceDir, 'src', 'index.ts'), 'utf8')).resolves.toBe('export const value = 3\n')
  })

  it('resolves image resources for streaming', async () => {
    await expect(resolveWorkspaceImageResource('assets/logo.png')).resolves.toEqual({
      filePath: join(workspaceDir, 'assets', 'logo.png'),
      mimeType: 'image/png',
      path: 'assets/logo.png',
      size: 4
    })
  })

  it('rejects non-image resources', async () => {
    await expect(resolveWorkspaceImageResource('src/index.ts')).rejects.toMatchObject(
      {
        status: 400,
        code: 'workspace_resource_not_image'
      } satisfies Partial<HttpError>
    )
  })

  it('rejects paths outside the workspace root', async () => {
    await expect(readWorkspaceFile('../outside.ts')).rejects.toMatchObject(
      {
        status: 400,
        code: 'invalid_workspace_tree_path'
      } satisfies Partial<HttpError>
    )
  })

  it('rejects symbolic link files that resolve outside the workspace root', async () => {
    await symlink(join(externalDir, 'outside.ts'), join(workspaceDir, 'outside-link.ts'), 'file')

    await expect(readWorkspaceFile('outside-link.ts')).rejects.toMatchObject(
      {
        status: 400,
        code: 'workspace_file_path_escapes_workspace'
      } satisfies Partial<HttpError>
    )
  })

  it('rejects broken symbolic link files as not found', async () => {
    await symlink('missing.ts', join(workspaceDir, 'missing-link.ts'), 'file')

    await expect(readWorkspaceFile('missing-link.ts')).rejects.toMatchObject(
      {
        status: 404,
        code: 'workspace_file_not_found'
      } satisfies Partial<HttpError>
    )
  })

  it('rejects Git worktree pointer files as metadata links', async () => {
    await writeFile(join(workspaceDir, '.git'), `gitdir: ${join(externalDir, '.git')}\n`)

    await expect(readWorkspaceFile('.git')).rejects.toMatchObject(
      {
        status: 400,
        code: 'workspace_file_gitdir_pointer'
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
