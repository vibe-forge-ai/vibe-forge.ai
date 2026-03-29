import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'

import { run as runTask } from '@vibe-forge/task'

import { getBenchmarkCase, listBenchmarkCases } from './discover'
import { writeBenchmarkResult } from './result-store'
import type { BenchmarkResult } from './schema'
import type {
  BenchmarkRunCaseInput,
  BenchmarkRunCaseOutput,
  BenchmarkRunCategoryInput,
  BenchmarkRunCategoryOutput,
  BenchmarkRunEvent
} from './types'
import { execCommand, execShellCommand, parseDiffFiles, summarizeText } from './utils'
import { createCaseWorkspace, disposeCaseWorkspace } from './workspace'

interface TaskExecutionResult {
  sessionId: string
  exitCode: number
  stderr: string
}

interface JudgedResult {
  status: BenchmarkResult['status']
  finalScore: number
  scores: BenchmarkResult['scores']
  judgeSummary: string
  issues: string[]
  changedFiles: string[]
}

const emitRunEvent = (
  input: BenchmarkRunCaseInput | BenchmarkRunCategoryInput,
  event: Omit<BenchmarkRunEvent, 'timestamp'>
) => {
  input.onEvent?.({
    ...event,
    timestamp: new Date().toISOString()
  })
}

const runAgentTask = async (
  input: BenchmarkRunCaseInput,
  taskDescription: string,
  cwd: string,
  timeoutSec: number
): Promise<TaskExecutionResult> => {
  const sessionId = randomUUID()

  return new Promise((resolve, reject) => {
    let sessionHandle: { kill: () => void } | undefined
    let settled = false
    let stderr = ''
    let exitCode = -1
    let timer: NodeJS.Timeout | undefined

    const finish = (value: TaskExecutionResult | Error, isError = false) => {
      if (settled) return
      settled = true
      if (timer != null) clearTimeout(timer)
      if (isError) {
        reject(value)
        return
      }
      resolve(value as TaskExecutionResult)
    }

    void (async () => {
      try {
        const { session } = await runTask({
          adapter: input.adapter,
          cwd,
          env: input.env
        }, {
          type: 'create',
          runtime: input.runtime ?? 'cli',
          sessionId,
          model: input.model,
          systemPrompt: input.systemPrompt,
          permissionMode: input.permissionMode,
          mode: 'stream',
          description: taskDescription,
          onEvent: (event) => {
            if (event.type === 'exit') {
              stderr = event.data.stderr ?? stderr
              exitCode = event.data.exitCode ?? exitCode
              finish({
                sessionId,
                exitCode,
                stderr
              })
            }
          }
        })

        sessionHandle = session
        timer = setTimeout(() => {
          sessionHandle?.kill()
          finish({
            sessionId,
            exitCode: -1,
            stderr: 'Task execution timed out'
          })
        }, timeoutSec * 1000)
      } catch (error) {
        finish(error as Error, true)
      }
    })()
  })
}

const collectCandidatePatch = async (cwd: string) => {
  await execCommand({
    command: 'git',
    args: ['add', '-N', '.'],
    cwd
  })
  const diffResult = await execCommand({
    command: 'git',
    args: ['diff', '--binary', '--no-ext-diff', '--submodule=diff', '--', '.'],
    cwd
  })
  if (diffResult.exitCode !== 0) {
    throw new Error(diffResult.stderr || 'Failed to collect candidate patch')
  }
  return diffResult.stdout
}

const applyPatchFromFile = async (cwd: string, patchPath: string) => {
  const result = await execCommand({
    command: 'git',
    args: ['apply', '--allow-empty', '--recount', '--whitespace=nowarn', '--binary', patchPath],
    cwd
  })
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to apply patch: ${patchPath}`)
  }
}

const judgeResult = (params: {
  testExitCode: number
  candidatePatch: string
  referencePatch: string
  taskExitCode: number
  taskStderr: string
}) => {
  const changedFiles = parseDiffFiles(params.candidatePatch)
  const referenceFiles = parseDiffFiles(params.referencePatch)
  const overlapCount = referenceFiles.filter(file => changedFiles.includes(file)).length
  const referenceScore = referenceFiles.length === 0
    ? (changedFiles.length > 0 ? 1 : 0)
    : Number((overlapCount / referenceFiles.length).toFixed(2))
  const testScore = params.testExitCode === 0 ? 1 : 0

  let goalScore = testScore
  const issues: string[] = []

  if (changedFiles.length === 0) {
    goalScore = 0
    issues.push('Agent 未产出代码改动')
  } else if (testScore === 0) {
    goalScore = Math.max(0.2, Number((referenceScore * 0.5).toFixed(2)))
    issues.push('验收测试未通过')
  }

  if (params.taskExitCode !== 0) {
    issues.push(`任务执行异常退出：${params.taskExitCode}`)
  }
  if (params.taskStderr.trim() !== '') {
    issues.push(`任务执行 stderr：${summarizeText(params.taskStderr, 240)}`)
  }
  if (referenceFiles.length > 0 && overlapCount === 0 && changedFiles.length > 0) {
    issues.push('改动文件与参考实现无重叠，需要人工复核目标一致性')
  }

  const finalScore = Number((0.7 * testScore + 0.2 * goalScore + 0.1 * referenceScore).toFixed(2))
  const status: BenchmarkResult['status'] = testScore === 1 && goalScore >= 0.8
    ? 'pass'
    : finalScore > 0
    ? 'partial'
    : 'fail'

  const judgeSummary = status === 'pass'
    ? '验收测试通过，任务目标完成度良好。'
    : status === 'partial'
    ? '实现存在部分有效改动，但仍需进一步完善。'
    : '当前实现未完成任务目标。'

  return {
    status,
    finalScore,
    scores: {
      testScore,
      goalScore,
      referenceScore
    },
    judgeSummary,
    issues,
    changedFiles
  } satisfies JudgedResult
}

export const runBenchmarkCase = async (input: BenchmarkRunCaseInput): Promise<BenchmarkRunCaseOutput> => {
  const workspaceFolder = input.workspaceFolder ?? process.cwd()
  const runId = input.runId ?? randomUUID()
  const startedAt = Date.now()

  emitRunEvent(input, {
    runId,
    category: input.category,
    title: input.title,
    scope: 'case',
    phase: 'discover',
    message: 'Loading benchmark case'
  })

  const caseItem = await getBenchmarkCase({
    workspaceFolder,
    category: input.category,
    title: input.title
  })

  if (caseItem == null) {
    throw new Error(`Benchmark case not found: ${input.category}/${input.title}`)
  }

  emitRunEvent(input, {
    runId,
    category: input.category,
    title: input.title,
    scope: 'case',
    phase: 'workspace',
    message: 'Preparing isolated benchmark workspace'
  })

  let workspaceState: Awaited<ReturnType<typeof createCaseWorkspace>> | null = null

  try {
    workspaceState = await createCaseWorkspace({
      workspaceFolder,
      category: input.category,
      title: input.title,
      runId,
      baseCommit: caseItem.frontmatter.baseCommit,
      setupCommand: caseItem.frontmatter.setupCommand,
      timeoutSec: caseItem.frontmatter.timeoutSec
    })

    emitRunEvent(input, {
      runId,
      category: input.category,
      title: input.title,
      scope: 'case',
      phase: 'task',
      message: 'Running task agent'
    })

    const taskResult = await runAgentTask(
      input,
      caseItem.rfcBody,
      workspaceState.caseWorkspacePath,
      caseItem.frontmatter.timeoutSec
    )
    const candidatePatch = await collectCandidatePatch(workspaceState.caseWorkspacePath)

    emitRunEvent(input, {
      runId,
      category: input.category,
      title: input.title,
      scope: 'case',
      phase: 'verify',
      message: 'Applying benchmark test patch'
    })

    await applyPatchFromFile(workspaceState.caseWorkspacePath, caseItem.patchTestPath)
    const testResult = await execShellCommand({
      command: caseItem.frontmatter.testCommand,
      cwd: workspaceState.caseWorkspacePath,
      timeoutMs: caseItem.frontmatter.timeoutSec * 1000,
      env: input.env
    })
    const referencePatch = await readFile(caseItem.patchPath, 'utf-8')
    const judged = judgeResult({
      testExitCode: testResult.exitCode,
      candidatePatch,
      referencePatch,
      taskExitCode: taskResult.exitCode,
      taskStderr: taskResult.stderr
    })

    const result: BenchmarkResult = {
      category: caseItem.category,
      title: caseItem.title,
      status: judged.status,
      finalScore: judged.finalScore,
      scores: judged.scores,
      baseCommit: caseItem.frontmatter.baseCommit,
      durationMs: Date.now() - startedAt,
      setupCommand: caseItem.frontmatter.setupCommand,
      testCommand: caseItem.frontmatter.testCommand,
      testExitCode: testResult.exitCode,
      judgeSummary: judged.judgeSummary,
      issues: judged.issues,
      timestamp: new Date().toISOString(),
      runId,
      taskSessionId: taskResult.sessionId,
      taskExitCode: taskResult.exitCode,
      changedFiles: judged.changedFiles,
      categoryRunId: input.categoryRunId
    }

    await writeBenchmarkResult(workspaceFolder, result)

    emitRunEvent(input, {
      runId,
      category: input.category,
      title: input.title,
      scope: 'case',
      phase: 'result',
      message: `Benchmark completed with status ${result.status}`
    })

    return {
      runId,
      result
    }
  } catch (error) {
    const result: BenchmarkResult = {
      category: caseItem.category,
      title: caseItem.title,
      status: 'fail',
      finalScore: 0,
      scores: {
        testScore: 0,
        goalScore: 0,
        referenceScore: 0
      },
      baseCommit: caseItem.frontmatter.baseCommit,
      durationMs: Date.now() - startedAt,
      setupCommand: caseItem.frontmatter.setupCommand,
      testCommand: caseItem.frontmatter.testCommand,
      testExitCode: -1,
      judgeSummary: 'Benchmark 运行失败。',
      issues: [error instanceof Error ? error.message : String(error)],
      timestamp: new Date().toISOString(),
      runId,
      categoryRunId: input.categoryRunId
    }
    await writeBenchmarkResult(workspaceFolder, result)
    return {
      runId,
      result
    }
  } finally {
    if (workspaceState != null) {
      await disposeCaseWorkspace(workspaceState)
    }
  }
}

export const runBenchmarkCategory = async (input: BenchmarkRunCategoryInput): Promise<BenchmarkRunCategoryOutput> => {
  const workspaceFolder = input.workspaceFolder ?? process.cwd()
  const runId = input.runId ?? randomUUID()
  const allCases = await listBenchmarkCases({
    workspaceFolder,
    category: input.category
  })
  const selectedCases = input.titles?.length
    ? allCases.filter(item => input.titles?.includes(item.title))
    : allCases

  if (selectedCases.length === 0) {
    throw new Error(`No benchmark cases found for category: ${input.category}`)
  }

  const concurrency = Math.max(1, Math.min(input.concurrency ?? 2, selectedCases.length))
  const results: BenchmarkResult[] = []
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < selectedCases.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      const item = selectedCases[currentIndex]
      emitRunEvent(input, {
        runId,
        category: input.category,
        title: item.title,
        scope: 'category',
        phase: 'discover',
        message: `Scheduling case ${item.title}`
      })
      const output = await runBenchmarkCase({
        workspaceFolder,
        category: input.category,
        title: item.title,
        adapter: input.adapter,
        model: input.model,
        systemPrompt: input.systemPrompt,
        permissionMode: input.permissionMode,
        runtime: input.runtime,
        env: input.env,
        categoryRunId: runId,
        onEvent: input.onEvent
      })
      results.push(output.result)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  return {
    runId,
    category: input.category,
    results: results.sort((a, b) => a.title.localeCompare(b.title))
  }
}
