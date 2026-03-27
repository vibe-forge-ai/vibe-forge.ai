#!/usr/bin/env node

import { createRequire } from 'node:module'
import process from 'node:process'

import { register } from 'esbuild-register/dist/node'

register({
  target: `node${process.version.slice(1)}`,
  hookIgnoreNodeModules: false
})

const require = createRequire(import.meta.url)
const { runScriptsCli } = require('./cli.ts')

await runScriptsCli(process.argv)
