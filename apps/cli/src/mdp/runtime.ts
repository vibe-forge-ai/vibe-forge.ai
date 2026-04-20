import process from 'node:process'

import { createMdpClient, type MdpClient } from '@modeldriveprotocol/client/node'
import { buildConfigJsonVariables, loadConfigState } from '@vibe-forge/config'
import {
  buildRuntimeClientId,
  connectRuntimeClients,
  disconnectRuntimeClients,
  resolveMdpConfig,
  type RuntimeClientHandle
} from '@vibe-forge/mdp'
import type { AdapterInteractionRequest, AdapterSession, Config } from '@vibe-forge/types'

import type { ActiveCliSessionRecord } from '#~/commands/run/types.js'
import { buildCliSessionEntryContext, injectCliEntryContextIntoContent } from '#~/mdp/entry-context.js'
import {
  buildCliInputSkillContent,
  buildCliInteractionSkillContent,
  buildCliProcessSkillContent,
  buildCliSkillContent,
  toCliInteractionData,
  toCliMessageContent
} from '#~/mdp/runtime-helpers.js'

interface CliRuntimeState {
  record: ActiveCliSessionRecord
  taskCwd: string
  primaryWorkspaceCwd: string
  resolvedAdapter?: string
  session?: AdapterSession
  pendingInteraction?: AdapterInteractionRequest
}

export interface CliMdpRuntimeHandle {
  sync(state: Partial<CliRuntimeState>): void
  stop(): Promise<void>
}

type JsonObject = Record<string, unknown>

const asRecord = (value: unknown): JsonObject | undefined => (
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value)
    ? value as JsonObject
    : undefined
)

const asString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const buildCliMetadata = (state: CliRuntimeState, connectionKey: string) => ({
  component: 'cli',
  connectionKey,
  workspaceFolder: state.taskCwd,
  primaryWorkspaceFolder: state.primaryWorkspaceCwd,
  sessionId: state.record.detail.sessionId,
  ctxId: state.record.detail.ctxId,
  status: state.record.detail.status,
  pid: state.record.detail.pid ?? null,
  adapter: state.resolvedAdapter ?? state.record.detail.adapter ?? null,
  model: state.record.detail.model ?? null,
  outputFormat: state.record.resume.outputFormat,
  hasPendingInteraction: state.pendingInteraction != null,
  pendingInteractionId: state.pendingInteraction?.id ?? null,
  pendingInteractionKind: state.pendingInteraction?.payload.kind ?? null
})

const buildCliSelfResponse = (state: CliRuntimeState) => ({
  sessionId: state.record.detail.sessionId,
  ctxId: state.record.detail.ctxId,
  status: state.record.detail.status,
  pid: state.record.detail.pid,
  description: state.record.detail.description,
  adapter: state.resolvedAdapter ?? state.record.detail.adapter,
  model: state.record.detail.model,
  taskCwd: state.taskCwd,
  primaryWorkspaceCwd: state.primaryWorkspaceCwd,
  outputFormat: state.record.resume.outputFormat,
  pendingInteraction: state.pendingInteraction == null
    ? undefined
    : {
      id: state.pendingInteraction.id,
      payload: state.pendingInteraction.payload
    }
})

const buildCliStartupResponse = (state: CliRuntimeState) => ({
  sessionId: state.record.detail.sessionId,
  ctxId: state.record.detail.ctxId,
  resolvedAdapter: state.resolvedAdapter ?? state.record.resume.resolvedAdapter ?? state.record.detail.adapter,
  outputFormat: state.record.resume.outputFormat,
  cwd: state.record.resume.cwd,
  taskCwd: state.taskCwd,
  primaryWorkspaceCwd: state.primaryWorkspaceCwd,
  createdAt: state.record.resume.createdAt,
  updatedAt: state.record.resume.updatedAt,
  description: state.record.resume.description,
  taskOptions: state.record.resume.taskOptions,
  adapterOptions: state.record.resume.adapterOptions,
  detail: state.record.detail
})

const requireSession = (state: CliRuntimeState) => {
  if (state.session == null) {
    throw new Error('CLI runtime session is not available')
  }
  return state.session
}

const requireInteractionTarget = (state: CliRuntimeState, value: unknown) => {
  const payload = asRecord(value)
  const interactionId = asString(payload?.interactionId) || state.pendingInteraction?.id
  if (interactionId == null || interactionId.trim() === '') {
    throw new Error('interactionId is required when no pending interaction is active')
  }

  const data = payload?.data ?? payload?.response
  return {
    interactionId,
    data: toCliInteractionData(data)
  }
}

const loadResolvedMdpConfig = async (params: {
  cwd: string
  env: NodeJS.ProcessEnv
}): Promise<Config> => {
  const configState = await loadConfigState({
    cwd: params.cwd,
    jsonVariables: buildConfigJsonVariables(params.cwd, params.env)
  })
  return configState.mergedConfig
}

export const startCliMdpRuntime = async (params: {
  cwd: string
  primaryWorkspaceCwd: string
  env: NodeJS.ProcessEnv
  record: ActiveCliSessionRecord
  session: AdapterSession
  resolvedAdapter?: string
  pendingInteraction?: AdapterInteractionRequest
}): Promise<CliMdpRuntimeHandle> => {
  const mergedConfig = await loadResolvedMdpConfig({
    cwd: params.cwd,
    env: params.env
  })
  const mdp = resolveMdpConfig(mergedConfig)
  if (!mdp.enabled) {
    return {
      sync() {},
      async stop() {}
    }
  }

  const state: CliRuntimeState = {
    record: params.record,
    taskCwd: params.cwd,
    primaryWorkspaceCwd: params.primaryWorkspaceCwd,
    resolvedAdapter: params.resolvedAdapter,
    session: params.session,
    pendingInteraction: params.pendingInteraction
  }

  const getCliEntryContext = () => buildCliSessionEntryContext({
    config: mergedConfig,
    cwd: state.taskCwd,
    primaryWorkspaceCwd: state.primaryWorkspaceCwd,
    ctxId: state.record.detail.ctxId,
    sessionId: state.record.detail.sessionId,
    outputFormat: state.record.resume.outputFormat,
    adapter: state.resolvedAdapter ?? state.record.detail.adapter ?? undefined,
    model: state.record.detail.model ?? undefined
  })

  const handles = await connectRuntimeClients<MdpClient>({
    mdp,
    buildClientInfo: (connection) => ({
      id: buildRuntimeClientId([
        'cli',
        connection.key,
        params.cwd,
        params.record.detail.ctxId,
        params.record.detail.sessionId,
        String(process.pid)
      ]),
      name: 'Vibe Forge CLI',
      description: 'Active vf run session runtime',
      metadata: buildCliMetadata(state, connection.key)
    }),
    configureClient: (client) => {
      client.expose('/skill.md', buildCliSkillContent())
      client.expose('/state', {
        method: 'GET',
        description: 'Return the current vf run session status.'
      }, () => buildCliSelfResponse(state))
      client.expose('/startup', {
        method: 'GET',
        description: 'Return the startup options for the current vf run session.'
      }, () => buildCliStartupResponse(state))
      client.expose('/input/skill.md', buildCliInputSkillContent())
      client.expose('/input/send', {
        method: 'POST',
        description: 'Send a user message into the current vf run session.'
      }, ({ body }) => {
        requireSession(state).emit({
          type: 'message',
          content: injectCliEntryContextIntoContent(
            toCliMessageContent(body),
            getCliEntryContext()
          )
        })
        return { ok: true }
      })
      client.expose('/interaction/skill.md', buildCliInteractionSkillContent())
      client.expose('/interaction/respond', {
        method: 'POST',
        description: 'Submit input for the current pending interaction.'
      }, async ({ body }) => {
        const session = requireSession(state)
        if (typeof session.respondInteraction !== 'function') {
          throw new Error('current session does not support interaction responses')
        }

        const { interactionId, data } = requireInteractionTarget(state, body)
        await session.respondInteraction(interactionId, data)
        return { ok: true, interactionId }
      })
      client.expose('/process/skill.md', buildCliProcessSkillContent())
      client.expose('/process/interrupt', {
        method: 'POST',
        description: 'Interrupt the current vf run session turn.'
      }, () => {
        requireSession(state).emit({ type: 'interrupt' })
        return { ok: true }
      })
      client.expose('/process/stop', {
        method: 'POST',
        description: 'Gracefully stop the current vf run session.'
      }, () => {
        const session = requireSession(state)
        if (typeof session.stop === 'function') {
          session.stop()
        } else {
          session.emit({ type: 'stop' })
        }
        return { ok: true }
      })
      client.expose('/process/kill', {
        method: 'POST',
        description: 'Force kill the current vf run session.'
      }, () => {
        requireSession(state).kill()
        return { ok: true }
      })
    },
    createClient: ({ serverUrl, client, auth }) => createMdpClient({
      serverUrl,
      client,
      ...(auth == null ? {} : { auth }),
      reconnect: {
        enabled: true
      }
    }),
    onConnectionError: (connection, error) => {
      console.error(`[vf] MDP CLI runtime connect failed for "${connection.key}": ${error.message}`)
    }
  })

  return {
    sync(nextState) {
      Object.assign(state, nextState)
      for (const handle of handles) {
        handle.client.register({
          metadata: buildCliMetadata(state, handle.connection.key)
        })
      }
    },
    async stop() {
      await disconnectRuntimeClients(handles)
    }
  }
}
