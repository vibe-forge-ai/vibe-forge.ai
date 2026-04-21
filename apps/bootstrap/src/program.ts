import { Command } from 'commander'
import process from 'node:process'

import { APP_HELP_TEXT, BOOTSTRAP_HELP_TEXT, extractBootstrapFlags } from './bootstrap-flags'
import { BOOTSTRAP_DEBUG_ENV_NAME } from './debug'
import { launchDesktopApp } from './desktop-app'
import type { DesktopInstallMode, LaunchDesktopAppOptions } from './desktop-app'
import { launchInstalledPackage } from './package-launcher'
import { getBootstrapDescription, getBootstrapVersion } from './package-config'

interface BootstrapCliDeps {
  launchDesktopApp: (options: LaunchDesktopAppOptions) => Promise<void>
  launchInstalledPackage: (input: {
    commandName?: string
    forwardedArgs: string[]
    packageName: string
  }) => Promise<number>
}

type BootstrapTarget =
  | {
    forwardedArgs: string[]
    installMode?: DesktopInstallMode
    kind: 'desktop'
    persistInstallMode?: boolean
  }
  | {
    commandName?: string
    forwardedArgs: string[]
    kind: 'package'
    packageName: string
  }

const DEFAULT_DEPS: BootstrapCliDeps = {
  launchDesktopApp,
  launchInstalledPackage
}

const parseDesktopTarget = (args: string[]): BootstrapTarget => {
  const forwardedArgs = [...args]
  let installMode: DesktopInstallMode | undefined
  let persistInstallMode = false

  if (forwardedArgs[0] === 'cache') {
    forwardedArgs.shift()
    installMode = 'cache'
    persistInstallMode = true
  }

  const noCacheIndex = forwardedArgs.indexOf('--no-cache')
  if (noCacheIndex >= 0) {
    forwardedArgs.splice(noCacheIndex, 1)
    installMode = 'user'
    persistInstallMode = true
  }

  return {
    forwardedArgs,
    installMode,
    kind: 'desktop',
    persistInstallMode
  }
}

export const routeBootstrapCommand = (command: string | undefined, args: string[]): BootstrapTarget | undefined => {
  if (command == null || command.trim() === '') {
    return undefined
  }

  if (command === 'web') {
    return {
      commandName: 'vibe-forge-web',
      forwardedArgs: args,
      kind: 'package',
      packageName: '@vibe-forge/web'
    }
  }

  if (command === 'server') {
    return {
      commandName: 'vibe-forge-server',
      forwardedArgs: args,
      kind: 'package',
      packageName: '@vibe-forge/server'
    }
  }

  if (command === 'app') {
    return parseDesktopTarget(args)
  }

  if (command === 'cli') {
    return {
      commandName: 'vibe-forge',
      forwardedArgs: args,
      kind: 'package',
      packageName: '@vibe-forge/cli'
    }
  }

  return {
    commandName: 'vibe-forge',
    forwardedArgs: [command, ...args],
    kind: 'package',
    packageName: '@vibe-forge/cli'
  }
}

export const createBootstrapCli = (inputDeps: Partial<BootstrapCliDeps> = {}) => {
  const deps: BootstrapCliDeps = {
    ...DEFAULT_DEPS,
    ...inputDeps
  }
  const program = new Command()

  program
    .name('vibe-forge-bootstrap')
    .description(getBootstrapDescription())
    .helpOption(false)
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .argument('[command]', 'Reserved commands: web, server, app, cli')
    .argument('[args...]', 'Forwarded arguments for the delegated runtime')
    .showHelpAfterError()
    .addHelpText(
      'after',
      BOOTSTRAP_HELP_TEXT
    )
    .action(async (command: string | undefined, args: string[] = []) => {
      const { debug, forwardedArgs } = extractBootstrapFlags(args)
      if (debug) {
        process.env[BOOTSTRAP_DEBUG_ENV_NAME] = '1'
      }

      const target = routeBootstrapCommand(command, forwardedArgs)
      if (target == null) {
        program.outputHelp()
        return
      }

      if (target.kind === 'desktop') {
        if (target.forwardedArgs.includes('--help') || target.forwardedArgs.includes('-h')) {
          process.stdout.write(`${APP_HELP_TEXT}\n`)
          return
        }

        await deps.launchDesktopApp({
          forwardedArgs: target.forwardedArgs,
          installMode: target.installMode,
          persistInstallMode: target.persistInstallMode
        })
        return
      }

      const exitCode = await deps.launchInstalledPackage({
        packageName: target.packageName,
        commandName: target.commandName,
        forwardedArgs: target.forwardedArgs
      })

      if (exitCode !== 0) {
        process.exit(exitCode)
      }
    })

  return program
}

export const runBootstrapCli = async (argv = process.argv) => {
  const command = createBootstrapCli()
  const { debug, forwardedArgs } = extractBootstrapFlags(argv.slice(2))
  const userArgs = forwardedArgs
  if (debug) {
    process.env[BOOTSTRAP_DEBUG_ENV_NAME] = '1'
  }

  if (userArgs.length === 0 || (userArgs.length === 1 && ['-h', '--help'].includes(userArgs[0] ?? ''))) {
    command.outputHelp()
    return
  }

  if (userArgs.length === 1 && ['-V', '--version'].includes(userArgs[0] ?? '')) {
    process.stdout.write(`${getBootstrapVersion()}\n`)
    return
  }

  await command.parseAsync([argv[0] ?? 'node', argv[1] ?? 'vibe-forge-bootstrap', ...userArgs])
}
