#!/usr/bin/env node

require('@vibe-forge/cli-helper/entry').runCliPackageEntrypoint({
  packageDir: __dirname,
  sourceEntry: './src/mcp/cli',
  distEntry: './dist/mcp/cli.js'
})
