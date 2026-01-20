import process from 'node:process'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    port: Number(process.env.VITE_PORT ?? 5173)
  }
})
