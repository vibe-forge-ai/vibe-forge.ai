// 自动化规则与执行记录 API
export type { AutomationRule, AutomationRun, AutomationTask, AutomationTrigger } from './api/automation'
export {
  createAutomationRule,
  deleteAutomationRule,
  listAutomationRules,
  listAutomationRuns,
  runAutomationRule,
  updateAutomationRule
} from './api/automation'

export { ApiError, getApiErrorMessage } from './api/base'
export {
  getBenchmarkCase,
  getBenchmarkResult,
  getBenchmarkRun,
  listBenchmarkCases,
  listBenchmarkCategories,
  startBenchmarkRun
} from './api/benchmark'

// 配置读取与更新 API
export { getConfig, updateConfig } from './api/config'
export {
  checkoutSessionGitBranch,
  commitSessionGitChanges,
  createSessionGitBranch,
  getSessionGitState,
  getWorkspaceGitState,
  listSessionGitBranches,
  listSessionGitWorktrees,
  listWorkspaceGitBranches,
  listWorkspaceGitWorktrees,
  pushSessionGitBranch,
  syncSessionGitBranch
} from './api/git'

// 知识库与规则说明 API
export type { EntityDetail, EntitySummary, RuleDetail, RuleSummary, SpecDetail, SpecSummary } from './api/knowledge'
export { getEntityDetail, getRuleDetail, getSpecDetail, listEntities, listRules, listSpecs } from './api/knowledge'

// 项目与工程 API
export { createProject, listProjects } from './api/projects'

// 会话与消息 API
export {
  branchSessionFromMessage,
  createSessionManagedWorktree,
  createQueuedMessage,
  createSession,
  deleteQueuedMessage,
  deleteSession,
  forkSession,
  getSessionMessages,
  getSessionWorkspace,
  listSessions,
  listSessionWorkspaceTree,
  respondSessionInteraction,
  transferSessionWorkspaceToLocal,
  moveQueuedMessage,
  reorderQueuedMessages,
  updateQueuedMessage,
  updateSession,
  updateSessionTitle
} from './api/sessions'

// 基础响应类型与会话交互类型
export type { ApiOkResponse, ApiRemoveResponse, SessionInteraction, SessionMessagesResponse } from './api/types'
export type { WorkspaceTreeEntry } from './api/workspace'
export { listWorkspaceTree } from './api/workspace'

export type {
  GitAvailabilityReason,
  GitBranchKind,
  GitBranchListResult,
  GitBranchSummary,
  GitChangeSummary,
  GitCommitPayload,
  GitHeadCommitSummary,
  GitMutationResult,
  GitPushPayload,
  GitRepositoryState,
  GitWorktreeListResult,
  GitWorktreeSummary
} from '@vibe-forge/types'
export type { BenchmarkCase, BenchmarkCategory, BenchmarkResult, BenchmarkRunSummary } from '@vibe-forge/types'
export type { SessionWorkspace } from '@vibe-forge/types'
