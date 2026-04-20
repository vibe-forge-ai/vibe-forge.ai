import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import { InvalidArgumentError, program } from 'commander'

import { applyServerRuntimeEnv, runRuntimeEntry } from '@vibe-forge/server/cli-runtime'

import { getWebDescription, getWebVersion } from './package-config'

const nodeRequire = createRequire(__filename)

interface WebCliOptions {
  base?: string
  configDir?: string
  dataDir?: string
  host?: string
  logDir?: string
  port?: string
  publicBaseUrl?: string
  workspace?: string
}

const parsePort = (value: string) => {
  const normalizedValue = value.trim()
  const port = Number.parseInt(normalizedValue, 10)
  if (!Number.isInteger(port) || String(port) !== normalizedValue || port < 1 || port > 65535) {
    throw new InvalidArgumentError('port must be an integer between 1 and 65535')
  }

  return normalizedValue
}

program
  .name('vibe-forge-web')
  .description(getWebDescription())
  .version(getWebVersion())
  .showHelpAfterError()
  .option('--host <host>', 'Web host')
  .option('--port <port>', 'Web port', parsePort)
  .option('--base <path>', 'Mount path for the web UI')
  .option('--workspace <path>', 'Workspace root for config and assets')
  .option('--config-dir <path>', 'Override config directory')
  .option('--data-dir <path>', 'Override server data directory')
  .option('--log-dir <path>', 'Override server log directory')
  .option('--public-base-url <url>', 'External base URL used in links')
  .addHelpText(
    'after',
    `
Examples:
  npx @vibe-forge/web
  npx @vibe-forge/web --host 127.0.0.1 --port 8787 --base /ui
`
  )
  .action(async (options: WebCliOptions) => {
    const packageDir = process.env.__VF_PROJECT_PACKAGE_DIR__ ?? resolve(process.cwd(), 'apps/web')
    const serverPackageDir = dirname(nodeRequire.resolve('@vibe-forge/server/package.json'))
    const env = applyServerRuntimeEnv({
      cwd: process.cwd(),
      packageDir,
      options,
      defaults: {
        allowCors: false,
        clientBase: '/ui',
        clientMode: 'static',
        entryKind: 'web',
        serverHost: '127.0.0.1',
        serverPort: '8787',
        serverWsPath: '/ws'
      }
    })

    const exitCode = await runRuntimeEntry({
      entryPath: resolve(serverPackageDir, 'src/index.ts'),
      env
    })

    if (exitCode !== 0) {
      process.exit(exitCode)
    }
  })

void program.parseAsync(process.argv)
