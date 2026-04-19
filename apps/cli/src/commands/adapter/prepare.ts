import process from 'node:process'

import { buildConfigJsonVariables, loadConfigState } from '@vibe-forge/config'
import type { AdapterCliPrepareContext, AdapterCliPrepareResult } from '@vibe-forge/types'
import {
  PROJECT_PRIMARY_WORKSPACE_FOLDER_ENV,
  resolveProjectPrimaryWorkspaceFolder
} from '@vibe-forge/utils/project-cache-path'

import { resolveCliWorkspaceCwd } from '#~/workspace.js'

import { loadAdapterPreparePreparers, resolveAdapterPrepareRequests } from './prepare-selection'

export interface AdapterPrepareCommandOptions {
  all?: boolean
  fromPostinstall?: boolean
  json?: boolean
  quiet?: boolean
}

const toPrepareEnv = (cwd: string) => {
  const primaryWorkspaceFolder = resolveProjectPrimaryWorkspaceFolder(cwd, process.env) ?? cwd
  return {
    ...process.env,
    __VF_PROJECT_WORKSPACE_FOLDER__: cwd,
    [PROJECT_PRIMARY_WORKSPACE_FOLDER_ENV]: primaryWorkspaceFolder
  }
}

const createPrepareContext = async (quiet: boolean | undefined): Promise<AdapterCliPrepareContext> => {
  const cwd = resolveCliWorkspaceCwd()
  const env = toPrepareEnv(cwd)
  const configState = await loadConfigState({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd, env)
  })
  return {
    cwd,
    env,
    configs: [configState.projectConfig, configState.userConfig],
    configState,
    logger: {
      info: (...args: unknown[]) => {
        if (quiet === true) return
        console.error(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '))
      }
    }
  }
}

const printPrepareResults = (
  results: AdapterCliPrepareResult[],
  options: AdapterPrepareCommandOptions
) => {
  if (options.json === true) {
    console.log(JSON.stringify({ ok: true, prepared: results }, null, 2))
    return
  }

  if (options.quiet === true) return
  for (const result of results) {
    console.log(`Prepared ${result.title}: ${result.binaryPath}`)
  }
}

export const runAdapterPrepareCommand = async (
  targets: string[],
  options: AdapterPrepareCommandOptions
) => {
  const ctx = await createPrepareContext(options.quiet)
  const preparers = await loadAdapterPreparePreparers({
    config: ctx.configState?.mergedConfig ?? {},
    requiredTargets: targets
  })
  const requests = resolveAdapterPrepareRequests({
    all: options.all,
    config: ctx.configState?.mergedConfig ?? {},
    preparers,
    targets
  })

  if (requests.length === 0) {
    if (options.json === true) {
      console.log(JSON.stringify({ ok: true, prepared: [] }, null, 2))
    } else if (options.quiet !== true) {
      console.log('No adapter CLI prepare targets selected.')
      console.log('Set adapters.<adapter>.cli.prepareOnInstall: true, pass --all, or pass target names.')
    }
    return
  }

  const results: AdapterCliPrepareResult[] = []
  for (const request of requests) {
    results.push(
      await request.preparer.prepare(ctx, {
        target: request.target.key
      })
    )
  }
  printPrepareResults(results, options)
}

export { resolveAdapterPrepareRequests } from './prepare-selection'
