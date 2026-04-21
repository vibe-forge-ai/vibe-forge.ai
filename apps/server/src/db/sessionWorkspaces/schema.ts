import type { SchemaModule } from '../schema'

export const sessionWorkspacesSchemaModule: SchemaModule = {
  name: 'sessionWorkspaces',
  apply({ exec, ensureColumn }) {
    exec(`
      CREATE TABLE IF NOT EXISTS session_workspaces (
        sessionId TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        workspaceFolder TEXT NOT NULL,
        repositoryRoot TEXT,
        worktreePath TEXT,
        baseRef TEXT,
        worktreeEnvironment TEXT,
        cleanupPolicy TEXT NOT NULL DEFAULT 'delete_on_session_delete',
        state TEXT NOT NULL DEFAULT 'ready',
        lastError TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        deletedAt INTEGER
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_session_workspaces_worktreePath
        ON session_workspaces(worktreePath);
    `)

    ensureColumn('session_workspaces', 'repositoryRoot', 'TEXT')
    ensureColumn('session_workspaces', 'worktreePath', 'TEXT')
    ensureColumn('session_workspaces', 'baseRef', 'TEXT')
    ensureColumn('session_workspaces', 'worktreeEnvironment', 'TEXT')
    ensureColumn('session_workspaces', 'cleanupPolicy', "TEXT NOT NULL DEFAULT 'delete_on_session_delete'")
    ensureColumn('session_workspaces', 'state', "TEXT NOT NULL DEFAULT 'ready'")
    ensureColumn('session_workspaces', 'lastError', 'TEXT')
    ensureColumn('session_workspaces', 'deletedAt', 'INTEGER')
  }
}
