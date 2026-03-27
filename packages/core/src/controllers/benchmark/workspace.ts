import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import { execCommand, execShellCommand, linkPreparedNodeModules, pathExists } from './utils'

interface CategoryWorkspaceInput {
  workspaceFolder?: string
  category: string
  baseCommit: string
  setupCommand: string
  timeoutSec: number
}

interface CaseWorkspaceInput {
  workspaceFolder?: string
  category: string
  title: string
  runId: string
  baseCommit: string
  setupCommand: string
  timeoutSec: number
}

export interface CategoryWorkspaceState {
  workspacePath: string
  gitRoot: string
}

export interface CaseWorkspaceState extends CategoryWorkspaceState {
  caseWorkspacePath: string
}

const categoryWorkspaceInflight = new Map<string, Promise<CategoryWorkspaceState>>()

const resolveWorktreeRoot = (workspaceFolder = process.cwd()) => resolve(workspaceFolder, '.ai/worktress/benchmark')

const findGitRoot = async (workspaceFolder: string) => {
  const result = await execCommand({
    command: 'git',
    args: ['rev-parse', '--show-toplevel'],
    cwd: workspaceFolder
  })
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Failed to resolve git root')
  }
  return result.stdout.trim()
}

const detachWorktree = async (gitRoot: string, worktreePath: string) => {
  const result = await execCommand({
    command: 'git',
    args: ['worktree', 'remove', '--force', worktreePath],
    cwd: gitRoot
  })
  const output = `${result.stdout}\n${result.stderr}`
  if (result.exitCode !== 0 && !output.includes('is not a working tree')) {
    throw new Error(output.trim() || `Failed to remove worktree: ${worktreePath}`)
  }
}

export const ensureCategoryWorkspace = async (input: CategoryWorkspaceInput): Promise<CategoryWorkspaceState> => {
  const workspaceFolder = input.workspaceFolder ?? process.cwd()
  const lockKey = `${workspaceFolder}:${input.category}`
  const inflight = categoryWorkspaceInflight.get(lockKey)
  if (inflight != null) {
    return inflight
  }

  const promise = (async () => {
    const gitRoot = await findGitRoot(workspaceFolder)
    const worktreeRoot = resolveWorktreeRoot(workspaceFolder)
    const workspacePath = resolve(worktreeRoot, input.category)
    const statePath = resolve(workspacePath, '.benchmark-state.json')

    await mkdir(worktreeRoot, { recursive: true })

    const currentState = await pathExists(statePath)
      ? JSON.parse(await readFile(statePath, 'utf-8')) as {
        baseCommit?: string
        setupCommand?: string
      }
      : null

    const needsRecreate = !await pathExists(workspacePath) ||
      currentState?.baseCommit !== input.baseCommit ||
      currentState?.setupCommand !== input.setupCommand

    if (needsRecreate) {
      if (await pathExists(workspacePath)) {
        await detachWorktree(gitRoot, workspacePath)
        await rm(workspacePath, { force: true, recursive: true })
      }
      const addResult = await execCommand({
        command: 'git',
        args: ['worktree', 'add', '--force', '--detach', workspacePath, input.baseCommit],
        cwd: gitRoot
      })
      if (addResult.exitCode !== 0) {
        throw new Error(addResult.stderr || `Failed to create worktree for ${input.category}`)
      }
      if (input.setupCommand.trim() !== '') {
        const setupResult = await execShellCommand({
          command: input.setupCommand,
          cwd: workspacePath,
          timeoutMs: input.timeoutSec * 1000
        })
        if (setupResult.exitCode !== 0) {
          throw new Error(setupResult.stderr || setupResult.stdout || 'Failed to prepare category workspace')
        }
      }
      await writeFile(
        statePath,
        `${
          JSON.stringify(
            {
              baseCommit: input.baseCommit,
              setupCommand: input.setupCommand
            },
            null,
            2
          )
        }\n`,
        'utf-8'
      )
    }

    return {
      workspacePath,
      gitRoot
    }
  })()

  categoryWorkspaceInflight.set(lockKey, promise)

  try {
    return await promise
  } finally {
    categoryWorkspaceInflight.delete(lockKey)
  }
}

export const createCaseWorkspace = async (input: CaseWorkspaceInput): Promise<CaseWorkspaceState> => {
  const categoryWorkspace = await ensureCategoryWorkspace(input)
  const worktreeRoot = resolveWorktreeRoot(input.workspaceFolder ?? process.cwd())
  const caseRoot = resolve(worktreeRoot, '.cases', input.category)
  const caseWorkspacePath = resolve(caseRoot, `${input.title}-${input.runId}`)

  await mkdir(caseRoot, { recursive: true })
  if (await pathExists(caseWorkspacePath)) {
    await detachWorktree(categoryWorkspace.gitRoot, caseWorkspacePath)
    await rm(caseWorkspacePath, { force: true, recursive: true })
  }

  const addResult = await execCommand({
    command: 'git',
    args: ['worktree', 'add', '--force', '--detach', caseWorkspacePath, input.baseCommit],
    cwd: categoryWorkspace.gitRoot
  })
  if (addResult.exitCode !== 0) {
    throw new Error(addResult.stderr || `Failed to create case workspace for ${input.category}/${input.title}`)
  }

  await linkPreparedNodeModules(categoryWorkspace.workspacePath, caseWorkspacePath)

  if (input.setupCommand.trim() !== '') {
    const setupResult = await execShellCommand({
      command: input.setupCommand,
      cwd: caseWorkspacePath,
      timeoutMs: input.timeoutSec * 1000
    })
    if (setupResult.exitCode !== 0) {
      throw new Error(setupResult.stderr || setupResult.stdout || 'Failed to prepare case workspace')
    }
  }

  return {
    ...categoryWorkspace,
    caseWorkspacePath
  }
}

export const disposeCaseWorkspace = async (state: CaseWorkspaceState) => {
  await detachWorktree(state.gitRoot, state.caseWorkspacePath)
  if (await pathExists(state.caseWorkspacePath)) {
    await rm(state.caseWorkspacePath, { force: true, recursive: true })
  }
}
