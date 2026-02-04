export { default as logger } from './hooks'

declare module '@vibe-forge/core' {
  interface PluginMap {
    logger: {}
  }
}
