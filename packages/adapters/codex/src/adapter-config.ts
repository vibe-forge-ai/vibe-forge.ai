export {}

declare module '@vibe-forge/core' {
  interface AdapterMap {
    'codex': {
      /**
       * Sandbox policy passed to thread/start and turn/start.
       * Defaults to { type: 'workspaceWrite' }.
       */
      sandboxPolicy?: {
        type: 'readOnly' | 'workspaceWrite' | 'dangerFullAccess' | 'externalSandbox'
        writableRoots?: string[]
        networkAccess?: boolean | 'restricted' | 'enabled'
      }
      /** Enable Codex experimental API surface. Defaults to false. */
      experimentalApi?: boolean
      /** Client metadata reported to the Codex app-server. */
      clientInfo?: {
        name?: string
        title?: string
        version?: string
      }
      /** Reasoning effort level for supported models. */
      effort?: 'low' | 'medium' | 'high'
      /**
       * Feature flag overrides applied via `--enable` / `--disable`.
       * Keys are feature names from `codex features list`:
       * `undo`, `shell_tool`, `web_search_request`, `web_search_cached`,
       * `unified_exec`, `shell_snapshot`, `apply_patch_freeform`, `exec_policy`,
       * `experimental_windows_sandbox`, `elevated_windows_sandbox`,
       * `remote_compaction`, `remote_models`, `powershell_utf8`,
       * `enable_request_compression`, `tui2`.
       * `true` → `--enable <name>`, `false` → `--disable <name>`.
       */
      features?: Partial<
        Record<
          | 'undo'
          | 'shell_tool'
          | 'web_search_request'
          | 'web_search_cached'
          | 'unified_exec'
          | 'shell_snapshot'
          | 'apply_patch_freeform'
          | 'exec_policy'
          | 'experimental_windows_sandbox'
          | 'elevated_windows_sandbox'
          | 'remote_compaction'
          | 'remote_models'
          | 'powershell_utf8'
          | 'enable_request_compression'
          | 'tui2'
          | (string & {}),
          boolean
        >
      >
    }
  }

  interface Cache {
    'adapter.codex.threads': Record<string, string>
  }
}
