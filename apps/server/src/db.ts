import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { v4 as uuidv4 } from 'uuid'
import Database from 'better-sqlite3'

import type { Session } from '#~/types.js'

export class SqliteDb {
  private db: Database.Database
  private dbPath: string

  constructor() {
    // Resolve DB path
    let dbPath = process.env.DB_PATH

    if (!dbPath) {
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
      } else if (!dbPath.endsWith('.sqlite') && !dbPath.endsWith('.db')) {
        // If it's a file path but doesn't have sqlite extension, we assume it's the full path the user wants
        // but for consistency with previous logic, let's just make sure it's a file
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
        title TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_messages_sessionId ON messages(sessionId);
    `)
  }

  getSessions(): Session[] {
    const stmt = this.db.prepare('SELECT * FROM sessions ORDER BY createdAt DESC')
    return stmt.all() as Session[]
  }

  getSession(id: string): Session | undefined {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?')
    return stmt.get(id) as Session | undefined
  }

  saveMessage(sessionId: string, data: any) {
    const stmt = this.db.prepare('INSERT INTO messages (sessionId, data, createdAt) VALUES (?, ?, ?)')
    stmt.run(sessionId, JSON.stringify(data), Date.now())
  }

  getMessages(sessionId: string): any[] {
    const stmt = this.db.prepare('SELECT data FROM messages WHERE sessionId = ? ORDER BY id ASC')
    const rows = stmt.all(sessionId) as { data: string }[]
    return rows.map(r => JSON.parse(r.data))
  }

  copyMessages(fromSessionId: string, toSessionId: string) {
    const messages = this.getMessages(fromSessionId)
    for (const msg of messages) {
      this.saveMessage(toSessionId, msg)
    }
  }

  createSession(title?: string, id?: string): Session {
    const session: Session = {
      id: id || uuidv4(),
      title: title || '新会话',
      createdAt: Date.now(),
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
