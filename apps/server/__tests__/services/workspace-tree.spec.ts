import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
