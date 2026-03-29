import { fileURLToPath } from 'node:url'
import process from 'node:process'

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
    alias: {
      '@vibe-forge/utils/model-selection': fileURLToPath(new URL('../../packages/utils/src/model-selection.ts', import.meta.url)),
      '@vibe-forge/utils': fileURLToPath(new URL('../../packages/utils/src/index.ts', import.meta.url))
    },
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
