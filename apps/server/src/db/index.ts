import type Database from 'better-sqlite3'

import { createAutomationRepo } from '#~/automation/db/repo.js'
import type {
  AutomationRule,
  AutomationRuleDetail,
  AutomationRun,
  AutomationTask,
  AutomationTrigger
} from '#~/automation/db/types.js'

import { createChannelSessionsRepo } from './channelSessions.repo'
import { createConnection } from './connection'
import { createMessagesRepo } from './messages.repo'
import { initSchema } from './schema'
import { createSessionsRepo } from './sessions.repo'
import { createTagsRepo } from './tags.repo'

export class SqliteDb {
  private db: Database.Database
  private sessions: ReturnType<typeof createSessionsRepo>
  private messages: ReturnType<typeof createMessagesRepo>
  private channelSessions: ReturnType<typeof createChannelSessionsRepo>
  private tags: ReturnType<typeof createTagsRepo>
  private automation: ReturnType<typeof createAutomationRepo>

  constructor() {
    const { db } = createConnection()
    this.db = db
    initSchema(this.db)
    this.sessions = createSessionsRepo(this.db)
    this.messages = createMessagesRepo(this.db)
    this.channelSessions = createChannelSessionsRepo(this.db)
    this.tags = createTagsRepo(this.db)
    this.automation = createAutomationRepo(this.db)
  }

  getSessions(filter: 'active' | 'archived' | 'all' = 'active') {
    return this.sessions.getSessions(filter)
  }

  getSession(id: string) {
    return this.sessions.getSession(id)
  }

  updateSession(id: string, updates: Parameters<typeof this.sessions.updateSession>[1]) {
    return this.sessions.updateSession(id, updates)
  }

  updateSessionStarred(id: string, isStarred: boolean) {
    return this.sessions.updateSessionStarred(id, isStarred)
  }

  updateSessionArchived(id: string, isArchived: boolean) {
    return this.sessions.updateSessionArchived(id, isArchived)
  }

  updateSessionArchivedWithChildren(id: string, isArchived: boolean) {
    return this.sessions.updateSessionArchivedWithChildren(id, isArchived)
  }

  updateSessionTags(sessionId: string, tags: string[]) {
    return this.tags.updateSessionTags(sessionId, tags)
  }

  saveMessage(sessionId: string, data: unknown) {
    return this.messages.saveMessage(sessionId, data)
  }

  getMessages(sessionId: string) {
    return this.messages.getMessages(sessionId)
  }

  getChannelSession(channelType: string, sessionType: string, channelId: string) {
    return this.channelSessions.getChannelSession(channelType, sessionType, channelId)
  }

  getChannelSessionBySessionId(sessionId: string) {
    return this.channelSessions.getChannelSessionBySessionId(sessionId)
  }

  upsertChannelSession(row: Parameters<typeof this.channelSessions.upsertChannelSession>[0]) {
    return this.channelSessions.upsertChannelSession(row)
  }

  deleteChannelSessionBySessionId(sessionId: string) {
    return this.channelSessions.deleteChannelSessionBySessionId(sessionId)
  }

  copyMessages(fromSessionId: string, toSessionId: string) {
    return this.messages.copyMessages(fromSessionId, toSessionId)
  }

  createSession(title?: string, id?: string, status?: string, parentSessionId?: string) {
    return this.sessions.createSession(title, id, status, parentSessionId)
  }

  updateSessionTitle(id: string, title: string) {
    return this.sessions.updateSessionTitle(id, title)
  }

  updateSessionLastMessages(id: string, lastMessage?: string, lastUserMessage?: string) {
    return this.sessions.updateSessionLastMessages(id, lastMessage, lastUserMessage)
  }

  deleteSession(id: string) {
    return this.sessions.deleteSession(id)
  }

  close() {
    this.db.close()
  }

  listAutomationRules() {
    return this.automation.listAutomationRules()
  }

  listAutomationRuleDetails() {
    return this.automation.listAutomationRuleDetails()
  }

  getAutomationRuleDetail(id: string) {
    return this.automation.getAutomationRuleDetail(id)
  }

  getAutomationRule(id: string) {
    return this.automation.getAutomationRule(id)
  }

  createAutomationRule(rule: AutomationRule) {
    return this.automation.createAutomationRule(rule)
  }

  updateAutomationRule(id: string, updates: Partial<Omit<AutomationRule, 'id' | 'createdAt'>>) {
    return this.automation.updateAutomationRule(id, updates)
  }

  deleteAutomationRule(id: string) {
    return this.automation.deleteAutomationRule(id)
  }

  listAutomationTriggers(ruleId: string) {
    return this.automation.listAutomationTriggers(ruleId)
  }

  getAutomationTrigger(id: string) {
    return this.automation.getAutomationTrigger(id)
  }

  replaceAutomationTriggers(
    ruleId: string,
    triggers: Array<Omit<AutomationTrigger, 'id' | 'ruleId' | 'createdAt'> & { id?: string }>
  ) {
    return this.automation.replaceAutomationTriggers(ruleId, triggers)
  }

  listAutomationTasks(ruleId: string) {
    return this.automation.listAutomationTasks(ruleId)
  }

  replaceAutomationTasks(
    ruleId: string,
    tasks: Array<Omit<AutomationTask, 'id' | 'ruleId' | 'createdAt'> & { id?: string }>
  ) {
    return this.automation.replaceAutomationTasks(ruleId, tasks)
  }

  createAutomationRun(ruleId: string, sessionId: string, taskId?: string | null, taskTitle?: string | null) {
    return this.automation.createAutomationRun(ruleId, sessionId, taskId, taskTitle)
  }

  listAutomationRuns(ruleId: string, limit = 50) {
    return this.automation.listAutomationRuns(ruleId, limit)
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
