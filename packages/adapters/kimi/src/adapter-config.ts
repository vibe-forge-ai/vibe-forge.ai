export {}

declare module '@vibe-forge/types' {
  interface AdapterMap {
    kimi: {
      agent?: 'default' | 'okabe' | (string & {})
      thinking?: boolean
      showThinkingStream?: boolean
      maxStepsPerTurn?: number
      maxRetriesPerStep?: number
      maxRalphIterations?: number
      autoInstall?: boolean
      installPackage?: string
      installPython?: string
      uvPath?: string
      configContent?: Record<string, unknown>
    }
  }
}
