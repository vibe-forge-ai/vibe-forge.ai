#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import process from 'node:process'

const TYPECHECK_CONFIGS = [
  ['bundler', 'packages/tsconfigs/tsconfig.typecheck.bundler.json'],
  ['bundler:test', 'packages/tsconfigs/tsconfig.typecheck.bundler.test.json'],
  ['web', 'packages/tsconfigs/tsconfig.typecheck.bundler.web.json'],
  ['web:test', 'packages/tsconfigs/tsconfig.typecheck.bundler.web.test.json'],
  ['node', 'packages/tsconfigs/tsconfig.typecheck.node.json'],
  ['node:test', 'packages/tsconfigs/tsconfig.typecheck.node.test.json']
]

const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  process.stdout.write(
    `${
      [
        'Usage: pnpm typecheck [scope...]',
        '',
        'Available scopes:',
        ...TYPECHECK_CONFIGS.map(([name]) => `  - ${name}`)
      ].join('\n')
    }\n`
  )
  process.exit(0)
}

if (args.includes('--list')) {
  process.stdout.write(`${TYPECHECK_CONFIGS.map(([name]) => name).join('\n')}\n`)
  process.exit(0)
}

const requestedScopes = args.filter(arg => !arg.startsWith('-'))
const missingScopes = requestedScopes.filter(
  scope => !TYPECHECK_CONFIGS.some(([name]) => name === scope)
)

if (missingScopes.length > 0) {
  process.stderr.write(
    `Unknown typecheck scope: ${missingScopes.join(', ')}\n` +
      'Run `pnpm typecheck --list` to see valid scopes.\n'
  )
  process.exit(1)
}

const selectedConfigs = requestedScopes.length === 0
  ? TYPECHECK_CONFIGS
  : TYPECHECK_CONFIGS.filter(([name]) => requestedScopes.includes(name))

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

for (const [name, configPath] of selectedConfigs) {
  process.stdout.write(`\n[typecheck] ${name}\n`)
  const result = spawnSync(
    pnpmCmd,
    ['exec', 'tsc', '-p', configPath, '--pretty', 'false'],
    { stdio: 'inherit' }
  )

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}
