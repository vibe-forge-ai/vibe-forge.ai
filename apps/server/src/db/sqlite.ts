import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')

type DatabaseSyncOptions = import('node:sqlite').DatabaseSyncOptions
type StatementSync = import('node:sqlite').StatementSync

export type SqliteBindValue = null | number | bigint | string | NodeJS.ArrayBufferView

export interface SqliteRunResult {
  changes: number
  lastInsertRowid: number | bigint
}

export interface SqliteStatement {
  all: (...params: SqliteBindValue[]) => Record<string, unknown>[]
  get: (...params: SqliteBindValue[]) => Record<string, unknown> | undefined
  run: (...params: SqliteBindValue[]) => SqliteRunResult
}

type SqliteTransactionFn = (...args: unknown[]) => unknown

export interface SqliteDatabase {
  close: () => void
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
  transaction: <T extends SqliteTransactionFn>(fn: T) => T
}

function cloneRow(row: Record<string, unknown>) {
  return { ...row }
}

class NodeSqliteStatement implements SqliteStatement {
  constructor(private readonly statement: StatementSync) {}

  all(...params: SqliteBindValue[]) {
    return this.statement
      .all(...params)
      .map(row => cloneRow(row as Record<string, unknown>))
  }

  get(...params: SqliteBindValue[]) {
    const row = this.statement.get(...params) as Record<string, unknown> | undefined
    return row == null ? undefined : cloneRow(row)
  }

  run(...params: SqliteBindValue[]) {
    const result = this.statement.run(...params)
    return {
      changes: Number(result.changes),
      lastInsertRowid: result.lastInsertRowid
    }
  }
}

class NodeSqliteDatabase implements SqliteDatabase {
  private savepointId = 0

  constructor(private readonly database: DatabaseSync) {}

  close() {
    if (this.database.isOpen) {
      this.database.close()
    }
  }

  exec(sql: string) {
    this.database.exec(sql)
  }

  prepare(sql: string) {
    return new NodeSqliteStatement(this.database.prepare(sql))
  }

  transaction<T extends SqliteTransactionFn>(fn: T): T {
    return ((...args: Parameters<T>) => {
      const savepointName = this.database.isTransaction
        ? `vf_tx_${++this.savepointId}`
        : undefined

      this.database.exec(savepointName == null ? 'BEGIN' : `SAVEPOINT ${savepointName}`)

      try {
        const result = fn(...args)
        this.database.exec(savepointName == null ? 'COMMIT' : `RELEASE SAVEPOINT ${savepointName}`)
        return result
      } catch (error) {
        if (savepointName == null) {
          if (this.database.isTransaction) {
            this.database.exec('ROLLBACK')
          }
        } else {
          this.database.exec(`ROLLBACK TO SAVEPOINT ${savepointName}`)
          this.database.exec(`RELEASE SAVEPOINT ${savepointName}`)
        }
        throw error
      }
    }) as T
  }
}

const defaultDatabaseOptions = {
  enableForeignKeyConstraints: false
} satisfies DatabaseSyncOptions

export function createSqliteDatabase(path: string, options: DatabaseSyncOptions = {}) {
  return new NodeSqliteDatabase(
    new DatabaseSync(path, {
      ...defaultDatabaseOptions,
      ...options
    })
  )
}
