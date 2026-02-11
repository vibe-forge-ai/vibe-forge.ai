import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { env as processEnv } from 'node:process'

import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

import { safeJsonStringify } from '#~/utils/json.js'
import type { ChatMessage, ChatMessageContent, Session } from '@vibe-forge/core'

interface SessionRow {
  id: string
  parentSessionId: string | null
  title: string | null
  lastMessage: string | null
  lastUserMessage: string | null
  createdAt: number
  messageCount: number
  lastMessageData?: string
  lastUserMessageData?: string
  isStarred: number
  isArchived: number
  tags?: string // JSON string array or comma separated
  status: string | null
}

export class SqliteDb {
  private db: Database.Database
  private dbPath: string

  constructor() {
    // Resolve DB path
    let dbPath = processEnv.DB_PATH

    if (dbPath == null || dbPath === '') {
      const homeDir = os.homedir()
      const vfDir = path.join(homeDir, '.vf')
      if (!fs.existsSync(vfDir)) {
        fs.mkdirSync(vfDir, { recursive: true })
      }
      dbPath = path.join(vfDir, 'db.sqlite')
    } else {
      const dir = path.dirname(dbPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      // If dbPath is a directory, append default filename
      if (fs.existsSync(dbPath) && fs.statSync(dbPath).isDirectory()) {
        dbPath = path.join(dbPath, 'db.sqlite')
      }
    }

    this.dbPath = dbPath
    this.db = new Database(dbPath)
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        parentSessionId TEXT,
        title TEXT,
        lastMessage TEXT,
        lastUserMessage TEXT,
        createdAt INTEGER NOT NULL,
        isStarred INTEGER DEFAULT 0,
        isArchived INTEGER DEFAULT 0,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS session_tags (
        sessionId TEXT NOT NULL,
        tagId INTEGER NOT NULL,
        PRIMARY KEY (sessionId, tagId),
        FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(tagId) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_sessionId ON messages(sessionId);
    `)

    // Ensure columns exist for existing databases
    const tableInfo = this.db.prepare('PRAGMA table_info(sessions)').all() as { name: string }[]
    const columns = tableInfo.map(c => c.name)
    if (!columns.includes('isStarred')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN isStarred INTEGER DEFAULT 0')
    }
    if (!columns.includes('isArchived')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN isArchived INTEGER DEFAULT 0')
    }
    if (!columns.includes('parentSessionId')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN parentSessionId TEXT')
    }
    if (!columns.includes('lastMessage')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN lastMessage TEXT')
    }
    if (!columns.includes('lastUserMessage')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN lastUserMessage TEXT')
    }
    if (!columns.includes('status')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN status TEXT')
    }
  }

  getSessions(filter: 'active' | 'archived' | 'all' = 'active'): Session[] {
    let whereClause = ''
    if (filter === 'active') {
      whereClause = 'WHERE isArchived = 0'
    } else if (filter === 'archived') {
      whereClause = 'WHERE isArchived = 1'
    }

    const stmt = this.db.prepare(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM messages WHERE sessionId = s.id) as messageCount,
             (SELECT GROUP_CONCAT(t.name) FROM tags t JOIN session_tags st ON t.id = st.tagId WHERE st.sessionId = s.id) as tags
      FROM sessions s 
      ${whereClause}
      ORDER BY isStarred DESC, createdAt DESC
    `)
    const rows = stmt.all() as SessionRow[]
    return rows.map(row => {
      return {
        id: row.id,
        parentSessionId: row.parentSessionId ?? undefined,
        title: row.title ?? undefined,
        createdAt: row.createdAt,
        messageCount: row.messageCount,
        lastMessage: row.lastMessage ?? undefined,
        lastUserMessage: row.lastUserMessage ?? undefined,
        isStarred: row.isStarred === 1,
        isArchived: row.isArchived === 1,
        tags: (row.tags != null && row.tags !== '') ? row.tags.split(',') : [],
        status: (row.status as any) ?? undefined
      }
    })
  }

  getSession(id: string): Session | undefined {
    const stmt = this.db.prepare(`
      SELECT s.*,
             (SELECT COUNT(*) FROM messages WHERE sessionId = s.id) as messageCount,
             (SELECT GROUP_CONCAT(t.name) FROM tags t JOIN session_tags st ON t.id = st.tagId WHERE st.sessionId = s.id) as tags
      FROM sessions s WHERE s.id = ?
    `)
    const row = stmt.get(id) as (SessionRow | undefined)
    if (row == null) return undefined
    return {
      id: row.id,
      parentSessionId: row.parentSessionId ?? undefined,
      title: row.title ?? undefined,
      createdAt: row.createdAt,
      messageCount: row.messageCount,
      lastMessage: row.lastMessage ?? undefined,
      lastUserMessage: row.lastUserMessage ?? undefined,
      isStarred: row.isStarred === 1,
      isArchived: row.isArchived === 1,
      tags: (row.tags != null && row.tags !== '') ? row.tags.split(',') : [],
      status: (row.status as any) ?? undefined
    }
  }

  private extractTextFromMessageData(messageData?: string): string | undefined {
    if (messageData == null || messageData === '') return undefined
    try {
      const data = JSON.parse(messageData) as ChatMessage
      if (typeof data.content === 'string') {
        return data.content
      } else if (Array.isArray(data.content)) {
        const textContent = data.content.find((c: ChatMessageContent) => c.type === 'text')
        if (textContent != null && 'text' in textContent) {
          return textContent.text
        }
      }
    } catch (e) {}
    return undefined
  }

  updateSession(id: string, updates: Partial<Omit<Session, 'id' | 'createdAt' | 'messageCount'>>) {
    const sets: string[] = []
    const params: (string | number | null)[] = []

    if (updates.title !== undefined) {
      sets.push('title = ?')
      params.push(updates.title)
    }
    if (updates.lastMessage !== undefined) {
      sets.push('lastMessage = ?')
      params.push(updates.lastMessage)
    }
    if (updates.lastUserMessage !== undefined) {
      sets.push('lastUserMessage = ?')
      params.push(updates.lastUserMessage)
    }
    if (updates.isStarred !== undefined) {
      sets.push('isStarred = ?')
      params.push(updates.isStarred ? 1 : 0)
    }
    if (updates.isArchived !== undefined) {
      sets.push('isArchived = ?')
      params.push(updates.isArchived ? 1 : 0)
    }
    if (updates.status !== undefined) {
      sets.push('status = ?')
      params.push(updates.status)
    }

    if (sets.length === 0) return

    const queryStr = `UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`
    params.push(id)

    const stmt = this.db.prepare(queryStr)
    stmt.run(...params)
  }

  updateSessionStarred(id: string, isStarred: boolean) {
    this.updateSession(id, { isStarred })
  }

  updateSessionArchived(id: string, isArchived: boolean) {
    this.updateSession(id, { isArchived })
  }

  updateSessionArchivedWithChildren(id: string, isArchived: boolean): string[] {
    const stmt = this.db.prepare('SELECT id FROM sessions WHERE parentSessionId = ?')
    const updateStmt = this.db.prepare('UPDATE sessions SET isArchived = ? WHERE id = ?')
    const updatedIds: string[] = []
    const stack = [id]

    while (stack.length > 0) {
      const currentId = stack.pop()
      if (!currentId) continue
      updateStmt.run(isArchived ? 1 : 0, currentId)
      updatedIds.push(currentId)
      const rows = stmt.all(currentId) as { id: string }[]
      for (const row of rows) {
        stack.push(row.id)
      }
    }

    return updatedIds
  }

  updateSessionTags(sessionId: string, tags: string[]) {
    const transaction = this.db.transaction(() => {
      // 1. Delete existing tags for this session
      this.db.prepare('DELETE FROM session_tags WHERE sessionId = ?').run(sessionId)

      // 2. Insert new tags and link them
      for (const tagName of tags) {
        // Ensure tag exists
        this.db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName)
        const tag = this.db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName) as { id: number }

        // Link session to tag
        this.db.prepare('INSERT OR IGNORE INTO session_tags (sessionId, tagId) VALUES (?, ?)').run(sessionId, tag.id)
      }
    })
    transaction()
  }

  saveMessage(sessionId: string, data: unknown) {
    const stmt = this.db.prepare('INSERT INTO messages (sessionId, data, createdAt) VALUES (?, ?, ?)')
    stmt.run(sessionId, safeJsonStringify(data), Date.now())
  }

  getMessages(sessionId: string): unknown[] {
    const stmt = this.db.prepare('SELECT data FROM messages WHERE sessionId = ? ORDER BY id ASC')
    const rows = stmt.all(sessionId) as { data: string }[]
    return rows.map(r => JSON.parse(r.data) as unknown)
  }

  copyMessages(fromSessionId: string, toSessionId: string) {
    const messages = this.getMessages(fromSessionId)
    for (const msg of messages) {
      this.saveMessage(toSessionId, msg)
    }
  }

  createSession(title?: string, id?: string, status?: string, parentSessionId?: string): Session {
    const session: Session = {
      id: id ?? uuidv4(),
      parentSessionId: parentSessionId ?? undefined,
      title,
      createdAt: Date.now(),
      status: (status as any) ?? undefined
    }
    const stmt = this.db.prepare('INSERT INTO sessions (id, parentSessionId, title, createdAt, status) VALUES (?, ?, ?, ?, ?)')
    stmt.run(session.id, session.parentSessionId ?? null, session.title, session.createdAt, session.status)
    return session
  }

  updateSessionTitle(id: string, title: string) {
    this.updateSession(id, { title })
  }

  updateSessionLastMessages(id: string, lastMessage?: string, lastUserMessage?: string) {
    this.updateSession(id, { lastMessage, lastUserMessage })
  }

  deleteSession(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  }

  close() {
    this.db.close()
  }
}

let dbInstance: SqliteDb | null = null

export function getDb() {
  if (!dbInstance) {
    dbInstance = new SqliteDb()
  }
  return dbInstance
}
