import type { SqliteDatabase } from '../sqlite'

export interface ChannelActionTokenRow {
  nonce: string
  action: string
  expiresAt: number
  consumedAt: number
}

export function createChannelActionTokensRepo(db: SqliteDatabase) {
  const pruneExpired = (now = Date.now()) => {
    const stmt = db.prepare(`
      DELETE FROM channel_action_tokens
      WHERE expiresAt <= ?
    `)
    return stmt.run(now).changes
  }

  const consume = db.transaction((row: ChannelActionTokenRow) => {
    pruneExpired(row.consumedAt)
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO channel_action_tokens (nonce, action, expiresAt, consumedAt)
      VALUES (?, ?, ?, ?)
    `)
    const result = stmt.run(row.nonce, row.action, row.expiresAt, row.consumedAt)
    return result.changes > 0
  })

  const clear = () => {
    const stmt = db.prepare('DELETE FROM channel_action_tokens')
    stmt.run()
  }

  return {
    clear,
    consume,
    pruneExpired
  }
}
