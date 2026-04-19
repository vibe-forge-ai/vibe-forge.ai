import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'

import { buildConfigJsonVariables, buildConfigSections, loadConfig, updateConfigFile } from '@vibe-forge/config'
import type { Config, PermissionInteractionDecision } from '@vibe-forge/types'
import {
  createEmptySessionPermissionState,
  normalizePermissionToolName,
  normalizeSessionPermissionState,
  resolvePermissionMirrorPath
} from '@vibe-forge/utils'
import type { SessionPermissionState } from '@vibe-forge/utils'

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

const mutateSessionPermissionState = (
  state: SessionPermissionState,
  keys: string[],
  action: PermissionInteractionDecision
) => {
  const targetKeys = normalizeKeys(keys)
  const keySet = new Set(targetKeys)
  const next = normalizeSessionPermissionState(state)

  if (action === 'allow_once') {
    next.onceAllow = uniqueStrings([...removeKeys(next.onceAllow, keySet), ...targetKeys])
    next.onceDeny = removeKeys(next.onceDeny, keySet)
    return next
  }
  if (action === 'allow_session' || action === 'allow_project') {
    next.allow = uniqueStrings([...removeKeys(next.allow, keySet), ...targetKeys])
    next.deny = removeKeys(next.deny, keySet)
    next.onceAllow = removeKeys(next.onceAllow, keySet)
    next.onceDeny = removeKeys(next.onceDeny, keySet)
    return next
  }
  if (action === 'deny_session' || action === 'deny_project') {
    next.deny = uniqueStrings([...removeKeys(next.deny, keySet), ...targetKeys])
    next.allow = removeKeys(next.allow, keySet)
    next.onceAllow = removeKeys(next.onceAllow, keySet)
    next.onceDeny = removeKeys(next.onceDeny, keySet)
    return next
  }
  return next
}

const loadTaskConfig = async (cwd: string) =>
  await loadConfig({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd, process.env)
  })

const readSessionPermissionState = async (cwd: string, adapter: string | undefined, sessionId: string) => {
  if (adapter !== 'claude-code' && adapter !== 'opencode') return createEmptySessionPermissionState()

  try {
    const raw = await readFile(resolvePermissionMirrorPath(cwd, adapter, sessionId), 'utf8')
    const parsed = JSON.parse(raw) as { permissionState?: SessionPermissionState }
    return normalizeSessionPermissionState(parsed.permissionState)
  } catch {
    return createEmptySessionPermissionState()
  }
}

const buildMergedProjectPermissions = async (cwd: string) => {
  const [projectConfig, userConfig] = await loadTaskConfig(cwd)
  return {
    allow: [...(projectConfig?.permissions?.allow ?? []), ...(userConfig?.permissions?.allow ?? [])],
    deny: [...(projectConfig?.permissions?.deny ?? []), ...(userConfig?.permissions?.deny ?? [])],
    ask: [...(projectConfig?.permissions?.ask ?? []), ...(userConfig?.permissions?.ask ?? [])]
  }
}

const updateProjectPermissionLists = async (cwd: string, keys: string[], target: 'allow' | 'deny') => {
  const targetKeys = normalizeKeys(keys)
  const keySet = new Set(targetKeys)
  const [projectConfig] = await loadTaskConfig(cwd)
  const existingPermissions = projectConfig?.permissions ?? {}
  const nextPermissions: Config['permissions'] = {
    ...existingPermissions,
    allow: removeKeys(existingPermissions.allow ?? [], keySet),
    deny: removeKeys(existingPermissions.deny ?? [], keySet),
    ask: removeKeys(existingPermissions.ask ?? [], keySet)
  }
  nextPermissions[target] = uniqueStrings([...(nextPermissions[target] ?? []), ...targetKeys])

  await updateConfigFile({
    workspaceFolder: cwd,
    source: 'project',
    section: 'general',
    value: buildGeneralSectionValue(projectConfig, nextPermissions)
  })
}

const syncPermissionStateMirror = async (params: {
  cwd: string
  adapter?: string
  sessionId: string
  permissionState: SessionPermissionState
}) => {
  if (params.adapter !== 'claude-code' && params.adapter !== 'opencode') return

  const mirrorPath = resolvePermissionMirrorPath(params.cwd, params.adapter, params.sessionId)
  const projectPermissions = await buildMergedProjectPermissions(params.cwd)
  await mkdir(dirname(mirrorPath), { recursive: true })
  await writeFile(
    mirrorPath,
    `${
      JSON.stringify(
        {
          sessionId: params.sessionId,
          adapter: params.adapter,
          permissionState: normalizeSessionPermissionState(params.permissionState),
          projectPermissions,
          updatedAt: Date.now()
        },
        null,
        2
      )
    }\n`,
    'utf8'
  )
}

export const applyCliPermissionDecision = async (params: {
  cwd: string
  sessionId: string
  adapter?: string
  subjectKeys: string[]
  action: PermissionInteractionDecision
}) => {
  const subjectKeys = normalizeKeys(params.subjectKeys)
  if (subjectKeys.length === 0) return createEmptySessionPermissionState()

  if (params.action === 'allow_project') await updateProjectPermissionLists(params.cwd, subjectKeys, 'allow')
  if (params.action === 'deny_project') await updateProjectPermissionLists(params.cwd, subjectKeys, 'deny')

  const nextState = mutateSessionPermissionState(
    await readSessionPermissionState(params.cwd, params.adapter, params.sessionId),
    subjectKeys,
    params.action
  )
  await syncPermissionStateMirror({
    cwd: params.cwd,
    adapter: params.adapter,
    sessionId: params.sessionId,
    permissionState: nextState
  })
  return nextState
}
