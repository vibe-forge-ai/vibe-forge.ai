import type { Task, TimelineEvent, TimelineEventType } from './types'
import { parseTime, sanitizeId } from './utils'

interface MermaidLabels {
  mainStart: string
  mainEnd: string
  startTasks: string
  allTasksDone: string
  askUserQuestion: string
  edit: string
  resumeTask: string
  userPrompt: string
  userAnswer: string
  receiveReply: string
  taskStart: string
  taskEnd: string
  ganttTitle: string
  ganttMainSection: string
  ganttTasksSection: string
}

interface MermaidCommitTarget {
  branchName?: string
  priority?: number
}

type TimelineOp =
  | {
    kind: 'commit'
    time: string
    branch: string
    commitId: string
    action?: string
    priority: number
    seq: number
  }
  | {
    kind: 'branch'
    time: string
    baseBranch: string
    name: string
    priority: number
    seq: number
  }
  | {
    kind: 'merge'
    time: string
    target: string
    source: string
    mergeId?: string
    action?: string
    priority: number
    seq: number
  }

interface MermaidLatestCommit {
  id: string
  branch: string
  time: string
  seq: number
}

interface MermaidRuntime {
  curBranch: string | undefined
  labels: MermaidLabels
  lines: string[]
  ops: TimelineOp[]
  commit: (timeId: string, action?: string, options?: MermaidCommitTarget) => string
  commitWithId: (commitId: string, action?: string) => string
  branch: (name: string) => void
  checkout: (name: string) => void
  merge: (
    name: string,
    id?: string,
    action?: string,
    options?: {
      branchName?: string
      time?: string
      seq?: number
    }
  ) => void
  addBranch: (time: string, baseBranch: string, name: string, priority: number) => void
  addMerge: (
    time: string,
    target: string,
    source: string,
    action: string,
    mergeId: string,
    priority: number
  ) => void
  ensureBranch: (name: string) => void
  normalizeCommitId: (value: string) => string
  allocateCommitId: (baseId: string) => string
  findLatestCommitId: (branchName?: string) => { id: string; branch: string } | undefined
  resumeCommitIds: Map<string, string>
  parentByBranch: Map<string, string>
}

function formatTag(action?: string) {
  if (!action) return undefined
  return action.replace(/"/g, "'")
}

function createCommitIdAllocator(usedCommitIds: Set<string>) {
  const normalizeCommitId = (value: string) => value.replace(/\s+/g, '_')
  const allocateCommitId = (baseId: string) => {
    let finalId = baseId
    let bump = 1
    while (usedCommitIds.has(finalId)) {
      finalId = `${baseId}_${bump}`
      bump += 1
    }
    usedCommitIds.add(finalId)
    return finalId
  }
  return {
    normalizeCommitId,
    allocateCommitId
  }
}

function getEventTitle(labels: MermaidLabels, type: TimelineEventType) {
  switch (type) {
    case 'tool__StartTasks':
      return labels.startTasks
    case 'tool__AskUserQuestion':
      return labels.askUserQuestion
    case 'tool__Edit':
      return labels.edit
    case 'tool__ResumeTask':
      return labels.resumeTask
    case 'user__Prompt':
      return labels.userPrompt
    default:
      return type
  }
}

function getOpBranchName(op: TimelineOp) {
  switch (op.kind) {
    case 'merge':
      return op.target
    case 'branch':
      return op.name
    default:
      return op.branch
  }
}

function sortTimelineOps(ops: TimelineOp[]) {
  return [...ops].sort((a, b) => {
    const timeDiff = parseTime(a.time) - parseTime(b.time)
    if (timeDiff !== 0) return timeDiff
    if (a.priority !== b.priority) return a.priority - b.priority
    const branchA = getOpBranchName(a)
    const branchB = getOpBranchName(b)
    if (branchA !== branchB) return branchA.localeCompare(branchB)
    return a.seq - b.seq
  })
}

function createMermaidRuntime(labels: MermaidLabels): MermaidRuntime {
  const lines: string[] = ['gitGraph']
  const createdBranches = new Set<string>()
  const usedCommitIds = new Set<string>()
  const { normalizeCommitId, allocateCommitId } = createCommitIdAllocator(usedCommitIds)

  const resumeCommitIds = new Map<string, string>()
  const latestCommitIds = new Map<string, string>()
  const commitBranchById = new Map<string, string>()
  const parentByBranch = new Map<string, string>()
  let globalLatestCommit: MermaidLatestCommit | undefined

  let curBranch: string | undefined
  let opSeq = 0
  const ops: TimelineOp[] = []

  const commitWithId = (commitId: string, action?: string) => {
    const safeAction = formatTag(action)
    if (safeAction) {
      lines.push(`commit id:"${commitId}" type: HIGHLIGHT tag:"${safeAction}"`)
    } else {
      lines.push(`commit id:"${commitId}"`)
    }
    return commitId
  }

  const updateGlobalLatestCommit = (commitId: string, branchName: string, time: string, seq: number) => {
    if (!globalLatestCommit) {
      globalLatestCommit = {
        id: commitId,
        branch: branchName,
        time,
        seq
      }
      return
    }
    const timeDiff = parseTime(time) - parseTime(globalLatestCommit.time)
    if (timeDiff > 0 || (timeDiff === 0 && seq > globalLatestCommit.seq)) {
      globalLatestCommit = {
        id: commitId,
        branch: branchName,
        time,
        seq
      }
    }
  }

  const findLatestCommitIdByBranch = (branchName: string) => {
    let cursor: string | undefined = branchName
    while (cursor) {
      const commitId = latestCommitIds.get(cursor)
      if (commitId) {
        return {
          id: commitId,
          branch: commitBranchById.get(commitId) ?? cursor
        }
      }
      const parent = parentByBranch.get(cursor)
      if (!parent || parent === cursor) break
      cursor = parent
    }
    return undefined
  }

  const findLatestCommitId = (branchName?: string) => {
    if (branchName) return findLatestCommitIdByBranch(branchName)
    if (!globalLatestCommit) return undefined
    return {
      id: globalLatestCommit.id,
      branch: globalLatestCommit.branch
    }
  }

  const commit = (timeId: string, action?: string, options?: MermaidCommitTarget) => {
    const baseId = normalizeCommitId(timeId)
    const commitId = allocateCommitId(baseId)
    if (options?.branchName && typeof options.priority === 'number') {
      ops.push({
        kind: 'commit',
        time: timeId,
        branch: options.branchName,
        commitId,
        action,
        priority: options.priority,
        seq: opSeq++
      })
      latestCommitIds.set(options.branchName, commitId)
      commitBranchById.set(commitId, options.branchName)
      updateGlobalLatestCommit(commitId, options.branchName, timeId, opSeq - 1)
      return commitId
    }
    return commitWithId(commitId, action)
  }

  const branch = (name: string) => {
    if (createdBranches.has(name)) return
    createdBranches.add(name)
    lines.push(`branch ${name}`)
  }

  const checkout = (name: string) => {
    curBranch = name
    lines.push(`checkout ${name}`)
  }

  const merge = (
    name: string,
    id?: string,
    action?: string,
    options?: {
      branchName?: string
      time?: string
      seq?: number
    }
  ) => {
    const items: string[] = []
    if (id) {
      items.push(`id:"${id}"`)
    }
    if (action) {
      items.push(`tag:"${action}"`)
    }
    lines.push(`merge ${name} ${items.join(' ')}`)
    if (id && options?.branchName && options.time && typeof options.seq === 'number') {
      latestCommitIds.set(options.branchName, id)
      commitBranchById.set(id, options.branchName)
      updateGlobalLatestCommit(id, options.branchName, options.time, options.seq)
    }
  }

  const addBranch = (time: string, baseBranch: string, name: string, priority: number) => {
    ops.push({
      kind: 'branch',
      time,
      baseBranch,
      name,
      priority,
      seq: opSeq++
    })
  }

  const addMerge = (
    time: string,
    target: string,
    source: string,
    action: string,
    mergeId: string,
    priority: number
  ) => {
    ops.push({
      kind: 'merge',
      time,
      target,
      source,
      action,
      mergeId,
      priority,
      seq: opSeq++
    })
  }

  const mainBranch = 'main'
  const ensureBranch = (name: string) => {
    if (name === mainBranch) return
    branch(name)
  }

  return {
    curBranch,
    labels,
    lines,
    ops,
    commit,
    commitWithId,
    branch,
    checkout,
    merge,
    addBranch,
    addMerge,
    ensureBranch,
    normalizeCommitId,
    allocateCommitId,
    findLatestCommitId,
    resumeCommitIds,
    parentByBranch
  }
}

function walkTimelineEvents(
  events: TimelineEvent[],
  activeBranch: string,
  parentBranch: string,
  runtime: MermaidRuntime
) {
  const {
    labels,
    commit,
    addBranch,
    addMerge,
    parentByBranch,
    resumeCommitIds
  } = runtime
  for (const event of events) {
    const { type, startTime, endTime } = event
    switch (type) {
      case 'tool__StartTasks': {
        commit(startTime, labels.taskStart, { branchName: activeBranch, priority: 10 })
        const { tasks = {} } = event
        for (const [taskName, task] of Object.entries(tasks)) {
          const taskBranch = sanitizeId(taskName)
          parentByBranch.set(taskBranch, activeBranch)
          addBranch(startTime, activeBranch, taskBranch, 15)
          const { events: taskEvents = [] } = task
          if (taskEvents.length > 0) {
            walkTimelineEvents(taskEvents, taskBranch, activeBranch, runtime)
          }
          commit(task.endTime, labels.taskEnd, { branchName: taskBranch, priority: 60 })
        }
        commit(endTime, labels.allTasksDone, { branchName: activeBranch, priority: 70 })
        break
      }
      case 'tool__AskUserQuestion':
        commit(startTime, labels.askUserQuestion, { branchName: activeBranch, priority: 20 })
        addMerge(endTime, parentBranch, activeBranch, labels.userAnswer, endTime, 80)
        break
      case 'tool__Edit':
        commit(startTime, getEventTitle(labels, type), { branchName: activeBranch, priority: 30 })
        break
      case 'tool__ResumeTask': {
        const commitId = commit(startTime, getEventTitle(labels, type), {
          branchName: activeBranch,
          priority: 40
        })
        resumeCommitIds.set(activeBranch, commitId)
        break
      }
      case 'user__Prompt':
        addMerge(startTime, activeBranch, '<prev_branch>', getEventTitle(labels, type), endTime, 50)
        break
      default:
        commit(endTime, getEventTitle(labels, type), { branchName: activeBranch, priority: 55 })
        break
    }
  }
}

function applyTimelineOps(runtime: MermaidRuntime) {
  const sortedOps = sortTimelineOps(runtime.ops)
  for (const op of sortedOps) {
    switch (op.kind) {
      case 'commit':
        runtime.ensureBranch(op.branch)
        runtime.checkout(op.branch)
        runtime.commitWithId(op.commitId, op.action)
        break
      case 'branch':
        runtime.checkout(op.baseBranch)
        runtime.ensureBranch(op.name)
        break
      case 'merge': {
        if (op.source === '<prev_branch>') {
          op.source = runtime.curBranch!
        }
        runtime.ensureBranch(op.target)
        runtime.ensureBranch(op.source)
        runtime.checkout(op.target)
        const baseId = runtime.normalizeCommitId(op.time)
        const mergeId = runtime.allocateCommitId(baseId)
        runtime.merge(op.source, mergeId, op.action, {
          branchName: op.target,
          time: op.time,
          seq: op.seq
        })
        break
      }
    }
  }
}

export function buildGitGraph(task: Task, labels: MermaidLabels) {
  const runtime = createMermaidRuntime(labels)
  const mainBranch = 'main'
  runtime.checkout(mainBranch)
  runtime.commit(task.startTime, labels.mainStart)
  walkTimelineEvents(task.events ?? [], mainBranch, mainBranch, runtime)
  applyTimelineOps(runtime)
  runtime.checkout(mainBranch)
  runtime.commit(task.endTime, labels.mainEnd)
  return runtime.lines.join('\n')
}
