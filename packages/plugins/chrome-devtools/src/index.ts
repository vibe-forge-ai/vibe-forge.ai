export { default as chromeDevtools } from './hooks'

declare module '@vibe-forge/types' {
  interface HookPluginMap {
    'chrome-devtools': {}
  }
}
