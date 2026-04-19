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
export { getConfig, getConfigSchema, updateConfig } from './api/config'
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
export type {
  EntityDetail,
  EntitySummary,
  RuleDetail,
  RuleSummary,
  SkillDetail,
  SkillHubInstallResult,
  SkillHubItem,
  SkillHubRegistrySummary,
  SkillHubSearchResult,
  SkillSummary,
  SpecDetail,
  SpecSummary,
  WorkspaceSummary
} from './api/knowledge'
export {
  createSkill,
  getEntityDetail,
  getRuleDetail,
  getSkillDetail,
  getSpecDetail,
  importSkillArchive,
  installSkillHubItem,
  listEntities,
  listRules,
  listSkills,
  listSpecs,
  listWorkspaces,
  searchSkillHub
} from './api/knowledge'

// 项目与工程 API
export { createProject, listProjects } from './api/projects'

// 会话与消息 API
export {
  branchSessionFromMessage,
  createQueuedMessage,
  createSession,
  createSessionManagedWorktree,
  deleteQueuedMessage,
  deleteSession,
  forkSession,
  getSessionMessages,
  getSessionWorkspace,
  getSessionWorkspaceResourceUrl,
  listSessionWorkspaceTree,
  listSessions,
  moveQueuedMessage,
  readSessionWorkspaceFile,
  reorderQueuedMessages,
  respondSessionInteraction,
  transferSessionWorkspaceToLocal,
  updateQueuedMessage,
  updateSession,
  updateSessionTitle,
  updateSessionWorkspaceFile
} from './api/sessions'

// 基础响应类型与会话交互类型
export type { ApiOkResponse, ApiRemoveResponse, SessionInteraction, SessionMessagesResponse } from './api/types'
export type { WorkspaceFileContent, WorkspaceTreeEntry } from './api/workspace'
export { getWorkspaceResourceUrl, listWorkspaceTree, readWorkspaceFile, updateWorkspaceFile } from './api/workspace'

// Worktree 环境脚本 API
export {
  deleteWorktreeEnvironment,
  getWorktreeEnvironment,
  listWorktreeEnvironments,
  saveWorktreeEnvironment
} from './api/worktree-environments'

export type {
  GitAvailabilityReason,
  GitBranchKind,
  GitBranchListResult,
  GitBranchSummary,
  GitChangeSummary,
  GitChangedFile,
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
export type {
  WorktreeEnvironmentDetail,
  WorktreeEnvironmentListResult,
  WorktreeEnvironmentMutationResult,
  WorktreeEnvironmentOperation,
  WorktreeEnvironmentPlatform,
  WorktreeEnvironmentSavePayload,
  WorktreeEnvironmentScript,
  WorktreeEnvironmentScriptKey,
  WorktreeEnvironmentSummary
} from '@vibe-forge/types'
