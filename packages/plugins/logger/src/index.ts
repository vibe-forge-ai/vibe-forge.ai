export { default as logger } from './hooks'

declare module '@vibe-forge/types' {
  interface HookPluginMap {
    logger: {}
  }
}
