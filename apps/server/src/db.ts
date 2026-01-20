import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { env as processEnv } from 'node:process'

import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

import type { ChatMessage, ChatMessageContent, Session } from '@vibe-forge/core'

interface SessionRow {
  id: string
  title: string | null
  createdAt: number
  messageCount: number
  lastMessageData?: string
  isStarred: number
  isArchived: number
  tags?: string // JSON string array or comma separated
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
        title TEXT,
        createdAt INTEGER NOT NULL,
        isStarred INTEGER DEFAULT 0,
        isArchived INTEGER DEFAULT 0
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
             (SELECT data FROM messages WHERE sessionId = s.id ORDER BY id DESC LIMIT 1) as lastMessageData,
             (SELECT GROUP_CONCAT(t.name) FROM tags t JOIN session_tags st ON t.id = st.tagId WHERE st.sessionId = s.id) as tags
      FROM sessions s 
      ${whereClause}
      ORDER BY isStarred DESC, createdAt DESC
    `)
    const rows = stmt.all() as SessionRow[]
    return rows.map(row => {
      let lastMessage = ''
      if (row.lastMessageData != null && row.lastMessageData !== '') {
        try {
          const data = JSON.parse(row.lastMessageData) as ChatMessage
          if (data.role === 'user' || data.role === 'assistant') {
            if (typeof data.content === 'string') {
              lastMessage = data.content
            } else if (Array.isArray(data.content)) {
              const textContent = data.content.find((c: ChatMessageContent) => c.type === 'text')
              if (textContent != null && 'text' in textContent) {
                lastMessage = textContent.text
              }
            }
          }
        } catch (e) {}
      }
      return {
        id: row.id,
        title: row.title ?? undefined,
        createdAt: row.createdAt,
        messageCount: row.messageCount,
        lastMessage,
        isStarred: row.isStarred === 1,
        isArchived: row.isArchived === 1,
        tags: (row.tags != null && row.tags !== '') ? row.tags.split(',') : []
      }
    })
  }

  getSession(id: string): Session | undefined {
    const stmt = this.db.prepare(`
      SELECT s.*,
             (SELECT GROUP_CONCAT(t.name) FROM tags t JOIN session_tags st ON t.id = st.tagId WHERE st.sessionId = s.id) as tags
      FROM sessions s WHERE s.id = ?
    `)
    const row = stmt.get(id) as (SessionRow | undefined)
    if (row == null) return undefined
    return {
      id: row.id,
      title: row.title ?? undefined,
      createdAt: row.createdAt,
      messageCount: row.messageCount,
      isStarred: row.isStarred === 1,
      isArchived: row.isArchived === 1,
      tags: (row.tags != null && row.tags !== '') ? row.tags.split(',') : []
    }
  }

  updateSessionStarred(id: string, isStarred: boolean) {
    const stmt = this.db.prepare('UPDATE sessions SET isStarred = ? WHERE id = ?')
    stmt.run(isStarred ? 1 : 0, id)
  }

  updateSessionArchived(id: string, isArchived: boolean) {
    const stmt = this.db.prepare('UPDATE sessions SET isArchived = ? WHERE id = ?')
    stmt.run(isArchived ? 1 : 0, id)
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
    stmt.run(sessionId, JSON.stringify(data), Date.now())
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

  createSession(title?: string, id?: string): Session {
    const session: Session = {
      id: id ?? uuidv4(),
      title,
      createdAt: Date.now()
    }
    const stmt = this.db.prepare('INSERT INTO sessions (id, title, createdAt) VALUES (?, ?, ?)')
    stmt.run(session.id, session.title, session.createdAt)
    return session
  }

  updateSessionTitle(id: string, title: string) {
    const stmt = this.db.prepare('UPDATE sessions SET title = ? WHERE id = ?')
    stmt.run(title, id)
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
