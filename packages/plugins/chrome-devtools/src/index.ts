export { default as chromeDevtools } from './hooks'

declare module '@vibe-forge/core' {
  interface PluginMap {
    'chrome-devtools': {}
  }
}
