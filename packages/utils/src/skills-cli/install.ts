import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { SkillsCliConfig } from '@vibe-forge/types'

import { selectInstalledSkillDir } from './installed-skill'
import { runSkillsCli } from './runtime'
import { normalizeNonEmptyString, stripAnsi, toSkillsCliError } from './shared'
import type { PublishSkillsCliResult } from './types'

export const installSkillsCliSkillToTemp = async (params: {
  config?: SkillsCliConfig
  registry?: string
  skill: string
  source: string
}) => {
  const source = normalizeNonEmptyString(params.source)
  const skill = normalizeNonEmptyString(params.skill)
  if (source == null || skill == null) {
    throw new Error('skills CLI source and skill are required.')
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'vf-skills-cli-install-'))
  try {
    await runSkillsCli({
      cwd: tempDir,
      config: params.config,
      registry: params.registry,
      args: ['add', source, '--skill', skill, '--agent', 'universal', '--copy', '-y']
    })

    const installedSkill = await selectInstalledSkillDir({
      installedSkillsDir: join(tempDir, '.agents', 'skills'),
      requestedSkill: skill
    })

    return {
      installedSkill,
      tempDir
    }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true })
    throw toSkillsCliError(error)
  }
}

export const installSkillsCliRefToTemp = async (params: {
  config?: SkillsCliConfig
  installRef: string
  registry?: string
}) => {
  const installRef = normalizeNonEmptyString(params.installRef)
  if (installRef == null) {
    throw new Error('skills CLI install ref is required.')
  }

  const atIndex = installRef.lastIndexOf('@')
  const requestedSkill = atIndex > 0 && atIndex < installRef.length - 1
    ? installRef.slice(atIndex + 1)
    : installRef
  const tempDir = await mkdtemp(join(tmpdir(), 'vf-skills-cli-install-'))
  try {
    await runSkillsCli({
      cwd: tempDir,
      config: params.config,
      registry: params.registry,
      args: ['add', installRef, '--agent', 'universal', '--copy', '-y']
    })

    const installedSkill = await selectInstalledSkillDir({
      installedSkillsDir: join(tempDir, '.agents', 'skills'),
      requestedSkill
    })

    return {
      installedSkill,
      tempDir
    }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true })
    throw toSkillsCliError(error)
  }
}

export const publishSkillsCli = async (params: {
  access?: string
  config?: SkillsCliConfig
  cwd: string
  group?: boolean | string
  region?: string
  registry?: string
  skillSpec: string
  yes?: boolean
}): Promise<PublishSkillsCliResult> => {
  const skillSpec = normalizeNonEmptyString(params.skillSpec)
  if (skillSpec == null) {
    throw new Error('skills CLI publish spec is required.')
  }

  const args = ['publish', skillSpec]
  const access = normalizeNonEmptyString(params.access)
  const region = normalizeNonEmptyString(params.region)
  const group = typeof params.group === 'string'
    ? normalizeNonEmptyString(params.group)
    : params.group

  if (params.yes === true) {
    args.push('-y')
  }
  if (access != null) {
    args.push('--access', access)
  }
  if (region != null) {
    args.push('--region', region)
  }
  if (group === true) {
    args.push('--group')
  } else if (typeof group === 'string') {
    args.push('--group', group)
  }

  try {
    const { stdout, stderr } = await runSkillsCli({
      cwd: params.cwd,
      config: params.config,
      registry: params.registry,
      args
    })

    return {
      stdout,
      stderr,
      output: [stdout, stderr]
        .map(chunk => stripAnsi(chunk).trim())
        .filter(Boolean)
        .join('\n')
    }
  } catch (error) {
    const normalized = toSkillsCliError(error)
    if (/Unknown command:\s*publish/i.test(normalized.message)) {
      throw new Error(
        'The configured skills CLI does not support publish. Configure skillsCli.registry or skillsCli.path to use a publish-capable skills CLI.'
      )
    }
    throw normalized
  }
}
