import process from 'node:process'

import type { SkillsCliConfig } from '@vibe-forge/types'

import {
  buildManagedNpmCliInstallEnv,
  resolveManagedNpmCliInstallOptions,
  resolveManagedNpmCliPaths
} from '../managed-npm-cli'
import { DEFAULT_MAX_BUFFER, buildSkillsCliEnv, execFileAsync, toInstallKey } from './shared'

export const resolveSkillsCliCommand = async (params: {
  config?: SkillsCliConfig
  cwd: string
  registry?: string
}) => {
  const cliEnv = buildSkillsCliEnv({
    config: params.config,
    registry: params.registry
  })
  const normalizedConfig = {
    source: 'managed' as const,
    ...(params.config?.source != null ? { source: params.config.source } : {}),
    ...(params.config?.path != null ? { path: params.config.path } : {}),
    ...(params.config?.package != null ? { package: params.config.package } : {}),
    ...(params.config?.version != null ? { version: params.config.version } : {}),
    ...(params.config?.autoInstall != null ? { autoInstall: params.config.autoInstall } : {}),
    ...(params.config?.prepareOnInstall != null ? { prepareOnInstall: params.config.prepareOnInstall } : {}),
    ...(params.config?.npmPath != null ? { npmPath: params.config.npmPath } : {})
  }
  const installOptions = resolveManagedNpmCliInstallOptions({
    adapterKey: 'skills_cli',
    defaultPackageName: 'skills',
    defaultVersion: 'latest',
    env: cliEnv,
    config: normalizedConfig
  })
  const explicitPath = params.config?.path?.trim()

  if (explicitPath != null && explicitPath !== '') {
    return {
      command: explicitPath,
      env: cliEnv,
      prefixArgs: [] as string[]
    }
  }

  if (installOptions.source === 'path') {
    throw new Error('skills CLI source=path requires an explicit path.')
  }

  if (installOptions.source === 'system') {
    return {
      command: 'skills',
      env: cliEnv,
      prefixArgs: [] as string[]
    }
  }

  const paths = resolveManagedNpmCliPaths({
    adapterKey: 'skills_cli',
    binaryName: 'skills',
    cwd: params.cwd,
    env: cliEnv,
    installKey: toInstallKey({
      config: params.config,
      registry: params.registry
    }),
    packageName: installOptions.packageName,
    version: installOptions.version
  })
  return {
    command: installOptions.npmPath,
    env: buildManagedNpmCliInstallEnv({
      cwd: params.cwd,
      env: cliEnv,
      paths
    }),
    prefixArgs: [
      'exec',
      '--yes',
      '--package',
      installOptions.packageSpec,
      '--',
      'skills'
    ]
  }
}

export const runSkillsCli = async (params: {
  args: string[]
  config?: SkillsCliConfig
  cwd: string
  registry?: string
}) => {
  const command = await resolveSkillsCliCommand({
    config: params.config,
    cwd: params.cwd,
    registry: params.registry
  })
  const env = {
    ...process.env,
    ...command.env,
    CI: '1',
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    TERM: 'dumb'
  }

  return await execFileAsync(command.command, [...command.prefixArgs, ...params.args], {
    cwd: params.cwd,
    env,
    maxBuffer: DEFAULT_MAX_BUFFER
  })
}
