import { resolve } from 'node:path'
import process from 'node:process'

import { InvalidArgumentError, program } from 'commander'

import { applyServerRuntimeEnv, runRuntimeEntry } from './cli-runtime'
import { getServerDescription, getServerVersion } from './package-config'

interface ServerCliOptions {
  allowCors?: boolean
  configDir?: string
  dataDir?: string
  host?: string
  logDir?: string
  port?: string
  publicBaseUrl?: string
  workspace?: string
  wsPath?: string
}

const parsePort = (value: string) => {
  const normalizedValue = value.trim()
  const port = Number.parseInt(normalizedValue, 10)
  if (!Number.isInteger(port) || String(port) !== normalizedValue || port < 1 || port > 65535) {
    throw new InvalidArgumentError('port must be an integer between 1 and 65535')
  }

  return normalizedValue
}

const parseWsPath = (value: string) => {
  const normalizedValue = value.trim()
  if (!normalizedValue.startsWith('/')) {
    throw new InvalidArgumentError('ws-path must start with "/"')
  }

  return normalizedValue
}

program
  .name('vibe-forge-server')
  .description(getServerDescription())
  .version(getServerVersion())
  .showHelpAfterError()
  .option('--host <host>', 'Server host')
  .option('--port <port>', 'Server port', parsePort)
  .option('--ws-path <path>', 'WebSocket path', parseWsPath)
  .option('--workspace <path>', 'Workspace root for config and assets')
  .option('--config-dir <path>', 'Override config directory')
  .option('--data-dir <path>', 'Override server data directory')
  .option('--log-dir <path>', 'Override server log directory')
  .option('--public-base-url <url>', 'External base URL used in links')
  .option('--allow-cors', 'Enable CORS for remote clients')
  .addHelpText(
    'after',
    `
Examples:
  npx @vibe-forge/server
  npx @vibe-forge/server --host 0.0.0.0 --port 8787 --allow-cors
`
  )
  .action(async (options: ServerCliOptions) => {
    const packageDir = process.env.__VF_PROJECT_PACKAGE_DIR__ ?? resolve(process.cwd(), 'apps/server')
    const env = applyServerRuntimeEnv({
      cwd: process.cwd(),
      packageDir,
      options,
      defaults: {
        allowCors: false,
        clientMode: 'none',
        entryKind: 'server',
        serverHost: '127.0.0.1',
        serverPort: '8787',
        serverWsPath: '/ws'
      }
    })

    const exitCode = await runRuntimeEntry({
      entryPath: resolve(packageDir, 'src/index.ts'),
      env
    })

    if (exitCode !== 0) {
      process.exit(exitCode)
    }
  })

void program.parseAsync(process.argv)
