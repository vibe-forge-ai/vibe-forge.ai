import type {} from '@vibe-forge/adapter-claude-code'
import { defineConfig } from '@vibe-forge/cli/config'

export default defineConfig({
  adapters: {
    'claude-code': {}
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
