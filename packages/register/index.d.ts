declare module '@vibe-forge/register/dotenv' {
  export interface LoadDotenvOptions {
    workspaceFolder?: string
    files?: string[]
  }

  export const loadDotenv: (options?: LoadDotenvOptions) => void
  export const resolvePrimaryWorkspaceFolder: (workspaceFolder: string) => string | undefined
  export const resolveProjectLaunchCwd: (cwd?: string, env?: NodeJS.ProcessEnv) => string
  export const resolveProjectWorkspaceFolder: (cwd?: string, env?: NodeJS.ProcessEnv) => string
  export const resolveProjectConfigDir: (cwd?: string, env?: NodeJS.ProcessEnv) => string | undefined
  export const resolveProjectAiBaseDir: (cwd?: string, env?: NodeJS.ProcessEnv) => string
}

declare module '@vibe-forge/register/mock-home-git' {
  export interface LinkRealHomeGitConfigOptions {
    realHome?: string
    mockHome?: string
  }

  export const linkRealHomeGitConfig: (options?: LinkRealHomeGitConfigOptions) => void
}

declare module '@vibe-forge/register/esbuild' {}

declare module '@vibe-forge/register/preload' {}
