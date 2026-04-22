import process from 'node:process'

import type { SkillsCliConfig } from '@vibe-forge/types'

import { ensureManagedNpmCli } from '../managed-npm-cli'
import { DEFAULT_MAX_BUFFER, buildSkillsCliEnv, execFileAsync, toInstallKey } from './shared'

export const resolveSkillsCliBinaryPath = async (params: {
  config?: SkillsCliConfig
  cwd: string
  registry?: string
}) => {
  const cliEnv = buildSkillsCliEnv({
    config: params.config,
    registry: params.registry
  })
  return ensureManagedNpmCli({
    adapterKey: 'skills_cli',
    binaryName: 'skills',
    cwd: params.cwd,
    env: cliEnv,
    installKey: toInstallKey({
      config: params.config,
      registry: params.registry
    }),
    config: {
      source: 'managed',
      ...(params.config?.source != null ? { source: params.config.source } : {}),
      ...(params.config?.path != null ? { path: params.config.path } : {}),
      ...(params.config?.package != null ? { package: params.config.package } : {}),
      ...(params.config?.version != null ? { version: params.config.version } : {}),
      ...(params.config?.autoInstall != null ? { autoInstall: params.config.autoInstall } : {}),
      ...(params.config?.prepareOnInstall != null ? { prepareOnInstall: params.config.prepareOnInstall } : {}),
      ...(params.config?.npmPath != null ? { npmPath: params.config.npmPath } : {})
    },
    defaultPackageName: 'skills',
    defaultVersion: 'latest',
    logger: {
      info: () => {}
    }
  })
}

export const runSkillsCli = async (params: {
  args: string[]
  config?: SkillsCliConfig
  cwd: string
  registry?: string
}) => {
  const binaryPath = await resolveSkillsCliBinaryPath({
    config: params.config,
    cwd: params.cwd,
    registry: params.registry
  })
  const env = {
    ...process.env,
    ...buildSkillsCliEnv({
      config: params.config,
      registry: params.registry
    }),
    CI: '1',
    FORCE_COLOR: '0',
    NO_COLOR: '1',
    TERM: 'dumb'
  }

  return await execFileAsync(binaryPath, params.args, {
    cwd: params.cwd,
    env,
    maxBuffer: DEFAULT_MAX_BUFFER
  })
}
