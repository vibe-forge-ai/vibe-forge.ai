/* eslint-disable max-lines */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { getDb } from '#~/db/index.js'
import { loadConfigState } from '#~/services/config/index.js'
import { resolveSessionWorkspaceFolder } from '#~/services/session/workspace.js'
import { getSessionLogger } from '#~/utils/logger.js'
import { buildConfigSections, updateConfigFile } from '@vibe-forge/config'
import type {
  AskUserQuestionParams,
  Config,
  PermissionInteractionContext,
  PermissionInteractionDecision,
  SessionPermissionMode
} from '@vibe-forge/types'
import {
  createEmptySessionPermissionState,
  normalizePermissionToolName,
  normalizeSessionPermissionState,
  resolvePermissionMirrorPath,
  resolvePermissionToolContext,
  splitManagedPermissionKeys
} from '@vibe-forge/utils'
import type { PermissionToolSubject, SessionPermissionState } from '@vibe-forge/utils'

export type PermissionStoredDecision = 'allow' | 'deny' | 'ask' | 'inherit'

export interface PermissionResolution {
  result: PermissionStoredDecision
  source:
    | 'onceAllow'
    | 'onceDeny'
    | 'sessionAllow'
    | 'sessionDeny'
    | 'projectAllow'
    | 'projectDeny'
    | 'projectAsk'
    | 'none'
  subject?: PermissionToolSubject
}

interface ProjectPermissionLists {
  allow: string[]
  deny: string[]
  ask: string[]
}

const PERMISSION_PROJECT_CONFIG_PATH = '.ai.config.json'

const uniqueStrings = (values: string[]) => [...new Set(values)]

const normalizeKeys = (values: string[]) =>
  uniqueStrings(
    values
      .map((value) => normalizePermissionToolName(value)?.key ?? value.trim())
      .filter((value): value is string => value.trim() !== '')
  )

const removeKeys = (values: string[], keys: Set<string>) => (
  values.filter((value) => {
    const normalized = normalizePermissionToolName(value)?.key ?? value.trim()
    return !keys.has(normalized)
  })
)

const buildGeneralSectionValue = (config: Config | undefined, permissions: Config['permissions']) => (
  buildConfigSections({
    ...(config ?? {}),
    permissions
  }).general
)

const getSessionPermissionState = (sessionId: string): SessionPermissionState => (
  normalizeSessionPermissionState(
    getDb().getSessionRuntimeState(sessionId)?.permissionState ?? createEmptySessionPermissionState()
  )
)

const syncPermissionStateMirrorBestEffort = async (
  sessionId: string,
  input: {
    adapter?: string
  } = {}
) => {
  try {
    await syncPermissionStateMirror(sessionId, input)
  } catch (error) {
    getSessionLogger(sessionId, 'server').warn({
      sessionId,
      adapter: input.adapter,
      error: error instanceof Error ? error.message : String(error)
    }, '[permission] Failed to sync permission state mirror')
  }
}

const updateSessionPermissionState = async (sessionId: string, state: SessionPermissionState) => {
  const normalized = normalizeSessionPermissionState(state)
  getDb().updateSessionRuntimeState(sessionId, { permissionState: normalized })
  await syncPermissionStateMirrorBestEffort(sessionId)
  return normalized
}

const buildMirrorProjectPermissions = (config: Config | undefined): ProjectPermissionLists => ({
  allow: splitManagedPermissionKeys(config?.permissions?.allow).bare,
  deny: splitManagedPermissionKeys(config?.permissions?.deny).bare,
  ask: splitManagedPermissionKeys(config?.permissions?.ask).bare
})

export const syncPermissionStateMirror = async (
  sessionId: string,
  input: {
    adapter?: string
  } = {}
) => {
  const adapter = input.adapter ?? getDb().getSession(sessionId)?.adapter
  if (adapter !== 'claude-code' && adapter !== 'kimi' && adapter !== 'opencode') {
    return
  }

  const workspaceFolder = await resolveSessionWorkspaceFolder(sessionId)
  const { mergedConfig } = await loadConfigState(workspaceFolder)
  const mirrorPath = resolvePermissionMirrorPath(workspaceFolder, adapter, sessionId)
  await mkdir(dirname(mirrorPath), { recursive: true })
  await writeFile(
    mirrorPath,
    `${
      JSON.stringify(
        {
          sessionId,
          adapter,
          permissionState: getSessionPermissionState(sessionId),
          projectPermissions: buildMirrorProjectPermissions(mergedConfig),
          updatedAt: Date.now()
        },
        null,
        2
      )
    }\n`,
    'utf8'
  )
}

export { syncPermissionStateMirrorBestEffort }

const resolveProjectPermissionLists = async (sessionId: string): Promise<ProjectPermissionLists> => {
  const workspaceFolder = await resolveSessionWorkspaceFolder(sessionId)
  const { mergedConfig } = await loadConfigState(workspaceFolder)
  return buildMirrorProjectPermissions(mergedConfig)
}

const resolveProjectDecision = (keys: string[], lists: ProjectPermissionLists): PermissionResolution => {
  if (keys.some(key => lists.deny.includes(key))) {
    return { result: 'deny', source: 'projectDeny' }
  }
  if (keys.some(key => lists.ask.includes(key))) {
    return { result: 'ask', source: 'projectAsk' }
  }
  if (keys.some(key => lists.allow.includes(key))) {
    return { result: 'allow', source: 'projectAllow' }
  }
  return { result: 'inherit', source: 'none' }
}

export const resolvePermissionDecision = async (params: {
  sessionId: string
  subject: PermissionToolSubject | undefined
  lookupKeys?: string[]
}): Promise<PermissionResolution> => {
  const { subject, sessionId } = params
  if (subject == null) {
    return { result: 'inherit', source: 'none' }
  }

  const keyCandidates = normalizeKeys([
    subject.key,
    ...(params.lookupKeys ?? [])
  ])
  const sessionState = getSessionPermissionState(sessionId)

  const matchedOnceDenyKeys = keyCandidates.filter(key => sessionState.onceDeny.includes(key))
  if (matchedOnceDenyKeys.length > 0) {
    await updateSessionPermissionState(sessionId, {
      ...sessionState,
      onceDeny: sessionState.onceDeny.filter(item => !matchedOnceDenyKeys.includes(item))
    })
    return { result: 'deny', source: 'onceDeny', subject }
  }

  const matchedOnceAllowKeys = keyCandidates.filter(key => sessionState.onceAllow.includes(key))
  if (matchedOnceAllowKeys.length > 0) {
    await updateSessionPermissionState(sessionId, {
      ...sessionState,
      onceAllow: sessionState.onceAllow.filter(item => !matchedOnceAllowKeys.includes(item))
    })
    return { result: 'allow', source: 'onceAllow', subject }
  }

  if (keyCandidates.some(key => sessionState.deny.includes(key))) {
    return { result: 'deny', source: 'sessionDeny', subject }
  }
  if (keyCandidates.some(key => sessionState.allow.includes(key))) {
    return { result: 'allow', source: 'sessionAllow', subject }
  }

  return {
    ...resolveProjectDecision(keyCandidates, await resolveProjectPermissionLists(sessionId)),
    subject
  }
}

const mutateSessionPermissionState = (
  state: SessionPermissionState,
  keys: string[],
  action: PermissionInteractionDecision
): SessionPermissionState => {
  const targetKeys = normalizeKeys(keys)
  const keySet = new Set(targetKeys)
  const next = normalizeSessionPermissionState(state)

  switch (action) {
    case 'allow_once':
      next.onceAllow = uniqueStrings([...removeKeys(next.onceAllow, keySet), ...targetKeys])
      next.onceDeny = removeKeys(next.onceDeny, keySet)
      return next
    case 'allow_session':
      next.allow = uniqueStrings([...removeKeys(next.allow, keySet), ...targetKeys])
      next.deny = removeKeys(next.deny, keySet)
      next.onceDeny = removeKeys(next.onceDeny, keySet)
      next.onceAllow = removeKeys(next.onceAllow, keySet)
      return next
    case 'allow_project':
      next.allow = uniqueStrings([...removeKeys(next.allow, keySet), ...targetKeys])
      next.deny = removeKeys(next.deny, keySet)
      next.onceDeny = removeKeys(next.onceDeny, keySet)
      next.onceAllow = removeKeys(next.onceAllow, keySet)
      return next
    case 'deny_once':
      return next
    case 'deny_session':
      next.deny = uniqueStrings([...removeKeys(next.deny, keySet), ...targetKeys])
      next.allow = removeKeys(next.allow, keySet)
      next.onceAllow = removeKeys(next.onceAllow, keySet)
      next.onceDeny = removeKeys(next.onceDeny, keySet)
      return next
    case 'deny_project':
      next.deny = uniqueStrings([...removeKeys(next.deny, keySet), ...targetKeys])
      next.allow = removeKeys(next.allow, keySet)
      next.onceAllow = removeKeys(next.onceAllow, keySet)
      next.onceDeny = removeKeys(next.onceDeny, keySet)
      return next
  }
}

const updateProjectPermissionLists = async (
  sessionId: string,
  keys: string[],
  target: 'allow' | 'deny'
) => {
  const targetKeys = normalizeKeys(keys)
  const keySet = new Set(targetKeys)
  const workspaceFolder = await resolveSessionWorkspaceFolder(sessionId)
  const { projectConfig } = await loadConfigState(workspaceFolder)
  const existingPermissions = projectConfig?.permissions ?? {}
  const nextPermissions: Config['permissions'] = {
    ...existingPermissions,
    allow: removeKeys(existingPermissions.allow ?? [], keySet),
    deny: removeKeys(existingPermissions.deny ?? [], keySet),
    ask: removeKeys(existingPermissions.ask ?? [], keySet)
  }
  nextPermissions[target] = uniqueStrings([...(nextPermissions[target] ?? []), ...targetKeys])

  await updateConfigFile({
    workspaceFolder,
    source: 'project',
    section: 'general',
    value: buildGeneralSectionValue(projectConfig, nextPermissions)
  })
}

export const applyPermissionInteractionDecision = async (params: {
  sessionId: string
  subjectKeys: string[]
  action: PermissionInteractionDecision
}) => {
  const subjectKeys = normalizeKeys(params.subjectKeys)
  if (subjectKeys.length === 0) return

  if (params.action === 'allow_project') {
    await updateProjectPermissionLists(params.sessionId, subjectKeys, 'allow')
  }
  if (params.action === 'deny_project') {
    await updateProjectPermissionLists(params.sessionId, subjectKeys, 'deny')
  }

  const nextState = mutateSessionPermissionState(
    getSessionPermissionState(params.sessionId),
    subjectKeys,
    params.action
  )
  await updateSessionPermissionState(params.sessionId, nextState)
}

const buildPermissionOption = (
  label: string,
  value: PermissionInteractionDecision,
  description: string
) => ({ label, value, description })

export const buildPermissionInteractionPayload = (params: {
  sessionId: string
  adapter?: string
  subjectKeys: string[]
  deniedTools?: string[]
  reasons?: string[]
  currentMode?: SessionPermissionMode
  suggestedMode?: SessionPermissionMode
}): AskUserQuestionParams => {
  const subjectKeys = normalizeKeys(params.subjectKeys)
  const primarySubjectKey = subjectKeys[0] ?? 'UnknownTool'
  const subjectLabel = subjectKeys.length <= 1
    ? primarySubjectKey
    : `${subjectKeys[0]} 等 ${subjectKeys.length} 项工具`
  const deniedTools = uniqueStrings([
    ...(params.deniedTools ?? []),
    ...subjectKeys
  ])
  const permissionContext: PermissionInteractionContext = {
    adapter: params.adapter,
    currentMode: params.currentMode,
    suggestedMode: params.suggestedMode,
    deniedTools,
    reasons: uniqueStrings(params.reasons ?? []),
    subjectKey: primarySubjectKey,
    subjectLabel,
    scope: 'tool',
    projectConfigPath: PERMISSION_PROJECT_CONFIG_PATH
  }

  return {
    sessionId: params.sessionId,
    kind: 'permission',
    question: subjectKeys.length <= 1
      ? `当前任务需要使用 ${subjectLabel ?? '该工具'} 才能继续，请选择处理方式。`
      : `当前任务涉及 ${subjectKeys.join('、')} 等工具，请选择处理方式。`,
    options: [
      buildPermissionOption('同意本次', 'allow_once', '仅继续这次被拦截的操作。'),
      buildPermissionOption('同意并在当前会话忽略类似调用', 'allow_session', '本会话内同类工具不再重复询问。'),
      buildPermissionOption(
        '同意并在当前项目忽略类似调用',
        'allow_project',
        `写入 ${PERMISSION_PROJECT_CONFIG_PATH}，后续新会话仍生效。`
      ),
      buildPermissionOption('拒绝本次', 'deny_once', '拒绝当前这次操作。'),
      buildPermissionOption('拒绝并在当前会话阻止类似调用', 'deny_session', '本会话内同类工具直接拒绝。'),
      buildPermissionOption(
        '拒绝并在当前项目阻止类似调用',
        'deny_project',
        `写入 ${PERMISSION_PROJECT_CONFIG_PATH}，后续新会话仍生效。`
      )
    ],
    permissionContext
  }
}

export const resolvePermissionSubjectFromInput = (params: {
  toolName?: string
  mcpServer?: string
}) => normalizePermissionToolName(params.toolName, { mcpServer: params.mcpServer })

export const resolvePermissionContextFromInput = (params: {
  toolName?: string
  mcpServer?: string
  toolInput?: unknown
}) => resolvePermissionToolContext(params.toolName, {
  mcpServer: params.mcpServer,
  toolInput: params.toolInput
})
