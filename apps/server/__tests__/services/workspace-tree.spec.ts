import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HttpError } from '#~/utils/http.js'

import { listWorkspaceTree } from '#~/services/workspace/tree.js'

describe('workspace tree service', () => {
  let workspaceDir: string
  let sessionWorkspaceDir: string

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'vf-workspace-tree-'))
    sessionWorkspaceDir = await mkdtemp(join(tmpdir(), 'vf-session-workspace-tree-'))
    vi.stubEnv('__VF_PROJECT_WORKSPACE_FOLDER__', workspaceDir)

    await mkdir(join(workspaceDir, 'src', 'nested'), { recursive: true })
    await mkdir(join(workspaceDir, '.ai', 'rules'), { recursive: true })
    await mkdir(join(workspaceDir, 'node_modules', 'pkg'), { recursive: true })
    await mkdir(join(sessionWorkspaceDir, 'docs'), { recursive: true })
    await writeFile(join(workspaceDir, 'README.md'), '# demo\n')
    await writeFile(join(workspaceDir, 'src', 'index.ts'), 'export {}\n')
    await writeFile(join(workspaceDir, '.ai', 'rules', 'rule.md'), 'rule\n')
    await writeFile(join(sessionWorkspaceDir, 'docs', 'guide.md'), '# guide\n')
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(workspaceDir, { recursive: true, force: true })
    await rm(sessionWorkspaceDir, { recursive: true, force: true })
  })

  it('lists workspace entries relative to the workspace root and skips ignored directories', async () => {
    await expect(listWorkspaceTree()).resolves.toEqual({
      path: '',
      entries: [
        { path: '.ai', name: '.ai', type: 'directory' },
        { path: 'src', name: 'src', type: 'directory' },
        { path: 'README.md', name: 'README.md', type: 'file' }
      ]
    })
  })

  it('lists nested directories using normalized relative paths', async () => {
    await expect(listWorkspaceTree('src')).resolves.toEqual({
      path: 'src',
      entries: [
        { path: 'src/nested', name: 'nested', type: 'directory' },
        { path: 'src/index.ts', name: 'index.ts', type: 'file' }
      ]
    })
  })

  it('lists symbolic links with their resolved link type', async () => {
    await symlink('src', join(workspaceDir, 'src-link'), 'dir')
    await symlink('README.md', join(workspaceDir, 'readme-link.md'), 'file')
    await symlink('missing.md', join(workspaceDir, 'broken-link.md'), 'file')
    await symlink(join(sessionWorkspaceDir, 'docs'), join(workspaceDir, 'external-docs'), 'dir')

    const result = await listWorkspaceTree()

    expect(result.entries).toEqual(expect.arrayContaining([
      {
        path: 'src-link',
        name: 'src-link',
        type: 'directory',
        isSymlink: true,
        linkKind: 'symlink',
        linkTarget: 'src',
        linkType: 'directory',
        isExternal: false
      },
      {
        path: 'external-docs',
        name: 'external-docs',
        type: 'directory',
        isSymlink: true,
        linkKind: 'symlink',
        linkTarget: join(sessionWorkspaceDir, 'docs'),
        linkType: 'directory',
        isExternal: true
      },
      {
        path: 'readme-link.md',
        name: 'readme-link.md',
        type: 'file',
        isSymlink: true,
        linkKind: 'symlink',
        linkTarget: 'README.md',
        linkType: 'file',
        isExternal: false
      },
      {
        path: 'broken-link.md',
        name: 'broken-link.md',
        type: 'file',
        isSymlink: true,
        linkKind: 'symlink',
        linkTarget: 'missing.md',
        linkType: 'missing'
      }
    ]))
  })

  it('lists Git worktree pointer files as special directory links', async () => {
    const gitdirPath = join(sessionWorkspaceDir, '.git', 'worktrees', 'demo')
    await mkdir(gitdirPath, { recursive: true })
    await writeFile(join(workspaceDir, '.git'), `gitdir: ${gitdirPath}\n`)

    const result = await listWorkspaceTree()

    expect(result.entries).toEqual(expect.arrayContaining([
      {
        path: '.git',
        name: '.git',
        type: 'directory',
        linkKind: 'gitdir',
        linkTarget: gitdirPath,
        linkType: 'directory',
        isExternal: true
      }
    ]))
  })

  it('lists an internal symbolic link directory through its workspace-relative path', async () => {
    await symlink('src', join(workspaceDir, 'src-link'), 'dir')

    await expect(listWorkspaceTree('src-link')).resolves.toEqual({
      path: 'src-link',
      entries: [
        { path: 'src-link/nested', name: 'nested', type: 'directory' },
        { path: 'src-link/index.ts', name: 'index.ts', type: 'file' }
      ]
    })
  })

  it('reports missing workspace tree paths as not found', async () => {
    await expect(listWorkspaceTree('missing')).rejects.toMatchObject(
      {
        status: 404,
        code: 'workspace_tree_path_not_found'
      } satisfies Partial<HttpError>
    )
  })

  it('rejects paths outside the workspace root', async () => {
    await expect(listWorkspaceTree('../outside')).rejects.toMatchObject(
      {
        status: 400,
        code: 'invalid_workspace_tree_path'
      } satisfies Partial<HttpError>
    )
  })

  it('supports listing an explicit session workspace folder', async () => {
    await expect(listWorkspaceTree(undefined, { workspaceFolder: sessionWorkspaceDir })).resolves.toEqual({
      path: '',
      entries: [
        { path: 'docs', name: 'docs', type: 'directory' }
      ]
    })
  })
})
