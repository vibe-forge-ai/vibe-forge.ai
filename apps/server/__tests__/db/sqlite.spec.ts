import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteDatabase } from '../../src/db/sqlite'
import type { SqliteDatabase } from '../../src/db/sqlite'

describe('node sqlite adapter', () => {
  let db: SqliteDatabase

  beforeEach(() => {
    db = createSqliteDatabase(':memory:')
    db.exec('CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT NOT NULL);')
  })

  afterEach(() => {
    db.close()
  })

  it('commits a successful transaction', () => {
    const insertItem = db.transaction((id: string, name: string) => {
      db.prepare('INSERT INTO items (id, name) VALUES (?, ?)').run(id, name)
    })

    insertItem('item-1', 'Item 1')

    expect(db.prepare('SELECT id, name FROM items ORDER BY id ASC').all()).toEqual([
      {
        id: 'item-1',
        name: 'Item 1'
      }
    ])
  })

  it('rolls back a failed transaction', () => {
    const insertThenFail = db.transaction(() => {
      db.prepare('INSERT INTO items (id, name) VALUES (?, ?)').run('item-1', 'Item 1')
      throw new Error('boom')
    })

    expect(() => insertThenFail()).toThrowError('boom')
    expect(db.prepare('SELECT id, name FROM items').all()).toEqual([])
  })

  it('uses savepoints for nested transactions', () => {
    const outer = db.transaction(() => {
      db.prepare('INSERT INTO items (id, name) VALUES (?, ?)').run('outer', 'Outer')

      const inner = db.transaction(() => {
        db.prepare('INSERT INTO items (id, name) VALUES (?, ?)').run('inner', 'Inner')
        throw new Error('inner failed')
      })

      expect(() => inner()).toThrowError('inner failed')
    })

    outer()

    expect(db.prepare('SELECT id, name FROM items ORDER BY id ASC').all()).toEqual([
      {
        id: 'outer',
        name: 'Outer'
      }
    ])
  })
})
