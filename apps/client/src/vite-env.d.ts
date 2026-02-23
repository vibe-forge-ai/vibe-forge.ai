/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly __VF_PROJECT_AI_SERVER_HOST__: string
  readonly __VF_PROJECT_AI_SERVER_PORT__: string
  readonly __VF_PROJECT_AI_CLIENT_HOST__: string
  readonly __VF_PROJECT_AI_CLIENT_PORT__: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
