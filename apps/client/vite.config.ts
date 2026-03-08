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
