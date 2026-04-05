import process from 'node:process'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const isDev = process.env.__VF_PROJECT_AI_CLIENT_MODE__ === 'dev'
const clientBase = isDev
  ? (process.env.__VF_PROJECT_AI_CLIENT_BASE__ ?? '/')
  : '/__VF_PROJECT_AI_CLIENT_BASE__/'

export default defineConfig({
  plugins: [
    react()
  ],
  root: '.',
  base: clientBase,
  resolve: {
    alias: [
      {
        find: '@vibe-forge/core/channel',
        replacement: fileURLToPath(new URL('../../packages/core/src/channel.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/plugin-chrome-devtools/schema',
        replacement: fileURLToPath(new URL('../../packages/plugins/chrome-devtools/src/schema.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/utils/model-selection',
        replacement: fileURLToPath(new URL('../../packages/utils/src/model-selection.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/utils/log-level',
        replacement: fileURLToPath(new URL('../../packages/utils/src/log-level.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/channel-lark',
        replacement: fileURLToPath(new URL('../../packages/channels/lark/src/index.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/core',
        replacement: fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/types',
        replacement: fileURLToPath(new URL('../../packages/types/src/index.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/utils',
        replacement: fileURLToPath(new URL('../../packages/utils/src/index.ts', import.meta.url))
      }
    ],
    conditions: ['browser', '__vibe-forge__', 'module', 'import', 'development']
  },
  server: {
    host: process.env.__VF_PROJECT_AI_CLIENT_HOST__,
    port: Number(process.env.__VF_PROJECT_AI_CLIENT_PORT__ ?? 5173)
  },
  envPrefix: [
    '__VF_PROJECT_AI_'
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  }
})
