import process from 'node:process'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  root: '.',
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
