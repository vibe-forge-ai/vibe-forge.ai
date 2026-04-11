export {}

declare module '@vibe-forge/types' {
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
      effort?: 'low' | 'medium' | 'high' | 'max'
      /**
       * Raw Codex config overrides encoded as dotted keys and values,
       * serialized to repeated `-c key=value` flags.
       * The adapter defaults `check_for_update_on_startup` to `false`
       * unless explicitly overridden here.
       */
      configOverrides?: Record<string, unknown>
      /**
       * Maximum completion tokens allowed for each turn in stream mode.
       * Useful when upstream Responses-compatible providers apply a low default.
       */
      maxOutputTokens?: number
      /**
       * Feature flag overrides applied via `--enable` / `--disable`.
       * Keys are feature names from `codex features list`:
       * `undo`, `shell_tool`, `web_search_request`, `web_search_cached`,
       * `unified_exec`, `shell_snapshot`, `apply_patch_freeform`, `exec_policy`,
       * `experimental_windows_sandbox`, `elevated_windows_sandbox`,
       * `remote_compaction`, `remote_models`, `powershell_utf8`, `codex_hooks`,
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
          | 'codex_hooks'
          | 'enable_request_compression'
          | 'tui2'
          | (string & {}),
          boolean
        >
      >
      nativeModelSwitch?: boolean
      nativeModelSwitchBootstrap?: boolean
    }
  }
}

declare module '@vibe-forge/types' {
  interface Cache {
    'adapter.codex.threads': Record<string, string>
    'adapter.codex.model-catalog': {
      models: Array<{
        slug: string
        display_name: string
      }>
    }
  }
}
