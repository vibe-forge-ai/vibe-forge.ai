/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly __VF_PROJECT_AI_SERVER_BASE_URL__: string
  readonly __VF_PROJECT_AI_SERVER_HOST__: string
  readonly __VF_PROJECT_AI_SERVER_PORT__: string
  readonly __VF_PROJECT_AI_SERVER_WS_PATH__: string
  readonly __VF_PROJECT_AI_CLIENT_HOST__: string
  readonly __VF_PROJECT_AI_CLIENT_MODE__: string
  readonly __VF_PROJECT_AI_CLIENT_DEPLOY_MODE__: string
  readonly __VF_PROJECT_AI_CLIENT_PORT__: string
  readonly __VF_PROJECT_AI_CLIENT_BASE__: string
  readonly __VF_PROJECT_AI_CLIENT_VERSION__: string
  readonly __VF_PROJECT_AI_CLIENT_COMMIT_HASH__: string
  readonly __VF_PROJECT_AI_DEV_GIT_REF__: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  __VF_PROJECT_AI_RUNTIME_ENV__?: Partial<{
    __VF_PROJECT_AI_SERVER_BASE_URL__: string
    __VF_PROJECT_AI_SERVER_HOST__: string
    __VF_PROJECT_AI_SERVER_PORT__: string
    __VF_PROJECT_AI_SERVER_WS_PATH__: string
    __VF_PROJECT_AI_CLIENT_MODE__: string
    __VF_PROJECT_AI_CLIENT_BASE__: string
    __VF_PROJECT_AI_CLIENT_VERSION__: string
    __VF_PROJECT_AI_CLIENT_COMMIT_HASH__: string
  }>
}
