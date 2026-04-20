import process from 'node:process'

import { buildRuntimeClientId, resolveMdpConfig } from '@vibe-forge/mdp'
import type { Config, SessionEntryContext, SessionEntryMdpClientRef } from '@vibe-forge/types'
import {
  buildSessionEntryContextSystemPrompt,
  prependSessionEntryContextToMessageContent
} from '@vibe-forge/utils'
import type { ChatMessageContent } from '@vibe-forge/core'

const buildCliEntryMdpRefs = (config: Config | undefined, params: {
  cwd: string
  ctxId: string
  sessionId: string
}): SessionEntryMdpClientRef[] => {
  const mdp = resolveMdpConfig(config)
  if (!mdp.enabled) {
    return []
  }

  return mdp.connections.map((connection) => {
    const rawClientId = buildRuntimeClientId([
      'cli',
      connection.key,
      params.cwd,
      params.ctxId,
      params.sessionId,
      String(process.pid)
    ])

    return {
      connectionKey: connection.key,
      clientId: `${connection.key}::${rawClientId}`,
      rawClientId
    }
  })
}

export const buildCliSessionEntryContext = (params: {
  config?: Config
  cwd: string
  primaryWorkspaceCwd: string
  ctxId: string
  sessionId: string
  outputFormat?: string
  adapter?: string
  model?: string
}): SessionEntryContext => {
  const refs = buildCliEntryMdpRefs(params.config, {
    cwd: params.cwd,
    ctxId: params.ctxId,
    sessionId: params.sessionId
  })

  return {
    kind: 'cli',
    sessionId: params.sessionId,
    cwd: params.cwd,
    ctxId: params.ctxId,
    primaryWorkspaceCwd: params.primaryWorkspaceCwd,
    pid: process.pid,
    ...(params.outputFormat == null ? {} : { outputFormat: params.outputFormat }),
    ...(params.adapter == null ? {} : { adapter: params.adapter }),
    ...(params.model == null ? {} : { model: params.model }),
    ...(refs.length === 0 ? {} : { mdp: { refs } })
  }
}

export const mergeCliSessionEntrySystemPrompt = (
  systemPrompt: string | undefined,
  entryContext: SessionEntryContext
) => [systemPrompt, buildSessionEntryContextSystemPrompt(entryContext)]
  .filter((value): value is string => value != null && value.trim() !== '')
  .join('\n\n')

export const injectCliEntryContextIntoContent = (
  content: ChatMessageContent[],
  entryContext: SessionEntryContext
) => prependSessionEntryContextToMessageContent(content, entryContext)
