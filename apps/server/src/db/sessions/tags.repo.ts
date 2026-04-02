import type { SqliteDatabase } from '../sqlite'

export function createTagsRepo(db: SqliteDatabase) {
  const replace = (sessionId: string, tags: string[]) => {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM session_tags WHERE sessionId = ?').run(sessionId)

      for (const tagName of tags) {
        db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName)
        const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get<{ id: number }>(tagName)
        if (tag == null) {
          throw new Error(`Failed to resolve tag id for ${tagName}.`)
        }
        db.prepare('INSERT OR IGNORE INTO session_tags (sessionId, tagId) VALUES (?, ?)').run(sessionId, tag.id)
      }
    })
    transaction()
  }

  return {
    replace
  }
}

export type TagsRepo = ReturnType<typeof createTagsRepo>
