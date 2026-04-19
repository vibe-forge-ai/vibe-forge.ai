import type { ManagedNpmCliConfig } from '@vibe-forge/utils/managed-npm-cli'

export {}

declare module '@vibe-forge/types' {
  interface Cache {
    'adapter.copilot.session': {
      copilotSessionId?: string
      title?: string
    }
  }

  interface AdapterMap {
    copilot: {
      cli?: ManagedNpmCliConfig
      cliPath?: string
      configDir?: string
      disableWorkspaceTrust?: boolean
      logDir?: string
      logLevel?: 'none' | 'error' | 'warning' | 'info' | 'debug' | 'all'
      agent?: string
      stream?: boolean
      allowAll?: boolean
      allowAllTools?: boolean
      allowAllPaths?: boolean
      allowAllUrls?: boolean
      disableBuiltinMcps?: boolean
      disabledMcpServers?: string[]
      enableAllGithubMcpTools?: boolean
      additionalGithubMcpToolsets?: string[]
      additionalGithubMcpTools?: string[]
      noCustomInstructions?: boolean
      noAskUser?: boolean
    }
  }
}
