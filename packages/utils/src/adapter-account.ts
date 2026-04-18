import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

import type { AdapterAccountCredentialArtifact, AdapterCtx } from '@vibe-forge/types'

import { resolveProjectAiPath } from './ai-path'

const assertRelativeArtifactPath = (value: string) => {
  const normalized = value.trim().replace(/\\/g, '/')
  if (normalized === '' || normalized.startsWith('/')) {
    throw new Error(`Invalid adapter account artifact path "${value}".`)
  }
  if (normalized.split('/').some(segment => segment === '..' || segment === '')) {
    throw new Error(`Adapter account artifact path "${value}" must stay inside the account directory.`)
  }
  return normalized
}

export const resolveAdapterAccountsRoot = (
  cwd: string,
  env: AdapterCtx['env'],
  adapter: string
) => resolveProjectAiPath(cwd, env, '.local', 'adapters', adapter, 'accounts')

export const resolveAdapterAccountDir = (
  cwd: string,
  env: AdapterCtx['env'],
  adapter: string,
  account: string
) => resolve(resolveAdapterAccountsRoot(cwd, env, adapter), account)

export const persistAdapterAccountArtifacts = async (params: {
  cwd: string
  env: AdapterCtx['env']
  adapter: string
  account: string
  artifacts: AdapterAccountCredentialArtifact[]
}) => {
  const accountDir = resolveAdapterAccountDir(params.cwd, params.env, params.adapter, params.account)

  for (const artifact of params.artifacts) {
    const relativeArtifactPath = assertRelativeArtifactPath(artifact.path)
    const targetPath = resolve(accountDir, relativeArtifactPath)
    const relativeTarget = relative(accountDir, targetPath).replace(/\\/g, '/')
    if (relativeTarget.startsWith('../') || relativeTarget === '..') {
      throw new Error(`Adapter account artifact path "${artifact.path}" resolves outside the account directory.`)
    }

    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, artifact.content, 'utf8')
  }

  return {
    accountDir
  }
}

export const removeStoredAdapterAccount = async (params: {
  cwd: string
  env: AdapterCtx['env']
  adapter: string
  account: string
}) => {
  const accountDir = resolveAdapterAccountDir(params.cwd, params.env, params.adapter, params.account)
  await rm(accountDir, { recursive: true, force: true })
  return {
    accountDir
  }
}
