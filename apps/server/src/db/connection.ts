import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { env as processEnv } from 'node:process'

import { createSqliteDatabase } from './sqlite'
import type { SqliteDatabase } from './sqlite'

export interface DbConnection {
  db: SqliteDatabase
  dbPath: string
}

export function createConnection(): DbConnection {
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
    if (fs.existsSync(dbPath) && fs.statSync(dbPath).isDirectory()) {
      dbPath = path.join(dbPath, 'db.sqlite')
    }
  }

  return {
    dbPath,
    db: createSqliteDatabase(dbPath)
  }
}
