import type Database from 'better-sqlite3'

export interface SchemaContext {
  db: Database.Database
  exec: (sql: string) => void
  getColumns: (tableName: string) => string[]
  ensureColumn: (tableName: string, columnName: string, definition: string) => void
}

export interface SchemaModule {
  name: string
  apply: (context: SchemaContext) => void
}

function createSchemaContext(db: Database.Database): SchemaContext {
  const getColumns = (tableName: string) => {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
    return rows.map(row => row.name)
  }

  return {
    db,
    exec: (sql: string) => {
      db.exec(sql)
    },
    getColumns,
    ensureColumn: (tableName: string, columnName: string, definition: string) => {
      const columns = getColumns(tableName)
      if (!columns.includes(columnName)) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
      }
    }
  }
}

export function initSchema(db: Database.Database, modules: readonly SchemaModule[]) {
  const context = createSchemaContext(db)
  for (const module of modules) {
    module.apply(context)
  }
}
