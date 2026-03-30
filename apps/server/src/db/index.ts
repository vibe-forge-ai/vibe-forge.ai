import { createAutomationRepo } from './automation/repo'
import type {
  AutomationRule,
  AutomationRuleDetail,
  AutomationRun,
  AutomationTask,
  AutomationTrigger
} from './automation/repo'
import { automationSchemaModule } from './automation/schema'
import { channelSessionsSchemaModule } from './channelSessions/schema'

import { createChannelSessionsRepo } from './channelSessions/repo'
import { createConnection } from './connection'
import { initSchema } from './schema'
import { createMessagesRepo } from './sessions/messages.repo'
import { createSessionsRepo } from './sessions/repo'
import { sessionsSchemaModule } from './sessions/schema'
import { createTagsRepo } from './sessions/tags.repo'
import type { SqliteDatabase } from './sqlite'

const dbSchemaModules = [sessionsSchemaModule, channelSessionsSchemaModule, automationSchemaModule] as const

export interface SqliteDbOptions {
  db?: SqliteDatabase
}

export class SqliteDb {
  private db: SqliteDatabase
  private sessions: ReturnType<typeof createSessionsRepo>
  private messages: ReturnType<typeof createMessagesRepo>
  private channelSessions: ReturnType<typeof createChannelSessionsRepo>
  private tags: ReturnType<typeof createTagsRepo>
  private automation: ReturnType<typeof createAutomationRepo>

  constructor(options: SqliteDbOptions = {}) {
    this.db = options.db ?? createConnection().db
    initSchema(this.db, dbSchemaModules)
    this.sessions = createSessionsRepo(this.db)
    this.messages = createMessagesRepo(this.db)
    this.channelSessions = createChannelSessionsRepo(this.db)
    this.tags = createTagsRepo(this.db)
    this.automation = createAutomationRepo(this.db)
  }

  getSessions(filter: 'active' | 'archived' | 'all' = 'active') {
    return this.sessions.list(filter)
  }

  getSession(id: string) {
    return this.sessions.get(id)
  }

  updateSession(id: string, updates: Parameters<typeof this.sessions.update>[1]) {
    return this.sessions.update(id, updates)
  }

  updateSessionStarred(id: string, isStarred: boolean) {
    return this.sessions.setStarred(id, isStarred)
  }

  updateSessionArchived(id: string, isArchived: boolean) {
    return this.sessions.setArchived(id, isArchived)
  }

  updateSessionArchivedWithChildren(id: string, isArchived: boolean) {
    return this.sessions.archiveTree(id, isArchived)
  }

  updateSessionTags(sessionId: string, tags: string[]) {
    return this.tags.replace(sessionId, tags)
  }

  saveMessage(sessionId: string, data: unknown) {
    return this.messages.save(sessionId, data)
  }

  getMessages(sessionId: string) {
    return this.messages.list(sessionId)
  }

  getChannelSession(channelType: string, sessionType: string, channelId: string) {
    return this.channelSessions.get(channelType, sessionType, channelId)
  }

  getChannelPreference(channelType: string, sessionType: string, channelId: string) {
    return this.channelSessions.getPreference(channelType, sessionType, channelId)
  }

  getChannelSessionBySessionId(sessionId: string) {
    return this.channelSessions.getBySessionId(sessionId)
  }

  upsertChannelSession(row: Parameters<typeof this.channelSessions.upsert>[0]) {
    return this.channelSessions.upsert(row)
  }

  upsertChannelPreference(row: Parameters<typeof this.channelSessions.upsertPreference>[0]) {
    return this.channelSessions.upsertPreference(row)
  }

  deleteChannelSessionBySessionId(sessionId: string) {
    return this.channelSessions.removeBySessionId(sessionId)
  }

  copyMessages(fromSessionId: string, toSessionId: string) {
    return this.messages.copy(fromSessionId, toSessionId)
  }

  createSession(title?: string, id?: string, status?: string, parentSessionId?: string) {
    return this.sessions.create(title, id, status, parentSessionId)
  }

  updateSessionTitle(id: string, title: string) {
    return this.sessions.setTitle(id, title)
  }

  updateSessionLastMessages(id: string, lastMessage?: string, lastUserMessage?: string) {
    return this.sessions.setLastMessages(id, lastMessage, lastUserMessage)
  }

  deleteSession(id: string) {
    return this.sessions.remove(id)
  }

  close() {
    this.db.close()
  }

  listAutomationRules() {
    return this.automation.listRules()
  }

  listAutomationRuleDetails() {
    return this.automation.listRuleDetails()
  }

  getAutomationRuleDetail(id: string) {
    return this.automation.getRuleDetail(id)
  }

  getAutomationRule(id: string) {
    return this.automation.getRule(id)
  }

  createAutomationRule(rule: AutomationRule) {
    return this.automation.createRule(rule)
  }

  updateAutomationRule(id: string, updates: Partial<Omit<AutomationRule, 'id' | 'createdAt'>>) {
    return this.automation.updateRule(id, updates)
  }

  deleteAutomationRule(id: string) {
    return this.automation.removeRule(id)
  }

  listAutomationTriggers(ruleId: string) {
    return this.automation.listTriggers(ruleId)
  }

  getAutomationTrigger(id: string) {
    return this.automation.getTrigger(id)
  }

  replaceAutomationTriggers(
    ruleId: string,
    triggers: Array<Omit<AutomationTrigger, 'id' | 'ruleId' | 'createdAt'> & { id?: string }>
  ) {
    return this.automation.replaceTriggers(ruleId, triggers)
  }

  listAutomationTasks(ruleId: string) {
    return this.automation.listTasks(ruleId)
  }

  replaceAutomationTasks(
    ruleId: string,
    tasks: Array<Omit<AutomationTask, 'id' | 'ruleId' | 'createdAt'> & { id?: string }>
  ) {
    return this.automation.replaceTasks(ruleId, tasks)
  }

  createAutomationRun(ruleId: string, sessionId: string, taskId?: string | null, taskTitle?: string | null) {
    return this.automation.createRun(ruleId, sessionId, taskId, taskTitle)
  }

  listAutomationRuns(ruleId: string, limit = 50) {
    return this.automation.listRuns(ruleId, limit)
  }
}

let dbInstance: SqliteDb | null = null

export function getDb() {
  if (!dbInstance) {
    dbInstance = new SqliteDb()
  }
  return dbInstance
}

export type { AutomationRule, AutomationRuleDetail, AutomationRun, AutomationTask, AutomationTrigger }
