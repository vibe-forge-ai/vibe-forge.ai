export interface LoadDotenvOptions {
  workspaceFolder?: string
  files?: string[]
}

export declare const loadDotenv: (options?: LoadDotenvOptions) => void
export declare const resolvePrimaryWorkspaceFolder: (workspaceFolder: string) => string | undefined
export declare const resolveProjectLaunchCwd: (cwd?: string, env?: NodeJS.ProcessEnv) => string
export declare const resolveProjectWorkspaceFolder: (cwd?: string, env?: NodeJS.ProcessEnv) => string
export declare const resolveProjectConfigDir: (cwd?: string, env?: NodeJS.ProcessEnv) => string | undefined
export declare const resolveProjectAiBaseDir: (cwd?: string, env?: NodeJS.ProcessEnv) => string
export declare const resolveProjectMockHome: (cwd?: string, env?: NodeJS.ProcessEnv) => string
