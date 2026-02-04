import type {} from '@vibe-forge/adapter-claude-code'
import type {} from '@vibe-forge/plugin-logger'
import { defineConfig } from '@vibe-forge/cli/config'

export default defineConfig({
  adapters: {
    'claude-code': {}
  },
  plugins: {
    logger: {}
  },
  mcpServers: {
    VibeForge: {
      command: './node_modules/.bin/vf',
      args: ['mcp']
    }
  },
  permissions: {
    allow: [],
    deny: [],
    ask: [
      'Bash(rm:*)',
      'Bash(kill:*)',
      'Bash(chmod:*)'
    ]
  }
})
