declare module '@vibe-forge/register/dotenv' {
  export interface LoadDotenvOptions {
    workspaceFolder?: string
    files?: string[]
  }

  export const loadDotenv: (options?: LoadDotenvOptions) => void
}

declare module '@vibe-forge/register/esbuild' {}

declare module '@vibe-forge/register/preload' {}
