export interface LoadDotenvOptions {
  workspaceFolder?: string
  files?: string[]
}

export declare const loadDotenv: (options?: LoadDotenvOptions) => void
export declare const resolvePrimaryWorkspaceFolder: (workspaceFolder: string) => string | undefined
