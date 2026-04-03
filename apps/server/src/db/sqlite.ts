import { createRequire } from 'node:module'
import type { DatabaseSync as NodeDatabaseSync, DatabaseSyncOptions, StatementSync } from 'node:sqlite'

const require = createRequire(__filename)
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')

export type SqliteBindValue = null | number | bigint | string | NodeJS.ArrayBufferView
type SqliteRow = object

export interface SqliteRunResult {
  changes: number
  lastInsertRowid: number | bigint
}

export interface SqliteStatement {
  all: <TRow extends SqliteRow = SqliteRow>(...params: SqliteBindValue[]) => TRow[]
  get: <TRow extends SqliteRow = SqliteRow>(...params: SqliteBindValue[]) => TRow | undefined
  run: (...params: SqliteBindValue[]) => SqliteRunResult
}

type SqliteTransactionFn = (...args: any[]) => unknown

export interface SqliteDatabase {
  close: () => void
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
  transaction: <T extends SqliteTransactionFn>(fn: T) => T
}

function cloneRow<TRow extends SqliteRow>(row: TRow): TRow {
  return { ...row }
}

class NodeSqliteStatement implements SqliteStatement {
  constructor(private readonly statement: StatementSync) {}

  all<TRow extends SqliteRow = SqliteRow>(...params: SqliteBindValue[]) {
    return this.statement
      .all(...params)
      .map(row => cloneRow(row as TRow))
  }

  get<TRow extends SqliteRow = SqliteRow>(...params: SqliteBindValue[]) {
    const row = this.statement.get(...params) as TRow | undefined
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

  constructor(private readonly database: NodeDatabaseSync) {}

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
