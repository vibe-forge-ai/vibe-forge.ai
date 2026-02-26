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

// 配置读取与更新 API
export { getConfig, updateConfig } from './api/config'

// 知识库与规则说明 API
export type { EntityDetail, EntitySummary, RuleDetail, RuleSummary, SpecDetail, SpecSummary } from './api/knowledge'
export { getEntityDetail, getRuleDetail, getSpecDetail, listEntities, listRules, listSpecs } from './api/knowledge'

// 项目与工程 API
export { createProject, listProjects } from './api/projects'

// 会话与消息 API
export {
  createSession,
  deleteSession,
  forkSession,
  getSessionMessages,
  listSessions,
  updateSession,
  updateSessionTitle
} from './api/sessions'

// 基础响应类型与会话交互类型
export type { ApiOkResponse, ApiRemoveResponse, SessionInteraction, SessionMessagesResponse } from './api/types'
