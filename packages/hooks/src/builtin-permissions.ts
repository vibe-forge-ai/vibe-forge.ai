import { readFile, writeFile } from 'node:fs/promises'

import {
  normalizeSessionPermissionState,
  resolvePermissionMirrorPath,
  resolvePermissionToolContext,
  splitManagedPermissionKeys
} from '@vibe-forge/utils'
import type { PermissionToolSubject } from '@vibe-forge/utils'

import type { Plugin } from './context'
import { definePlugin } from './context'
import type { HookOutputs } from './type'

interface PermissionCheckResponse {
  result?: 'allow' | 'deny' | 'ask' | 'inherit'
  source?: string
  subject?: PermissionToolSubject
}

const readMirrorDecision = async (params: {
  cwd: string
  adapter: string
  sessionId: string
  subject: PermissionToolSubject
  lookupKeys?: string[]
}) => {
  try {
    const raw = await readFile(resolvePermissionMirrorPath(params.cwd, params.adapter, params.sessionId), 'utf8')
    const parsed = JSON.parse(raw) as {
      permissionState?: { allow?: string[]; deny?: string[]; onceAllow?: string[]; onceDeny?: string[] }
      projectPermissions?: { allow?: string[]; deny?: string[]; ask?: string[] }
    }
    const permissionState = normalizeSessionPermissionState(parsed.permissionState)
    const projectPermissions = {
      allow: splitManagedPermissionKeys(parsed.projectPermissions?.allow).bare,
      deny: splitManagedPermissionKeys(parsed.projectPermissions?.deny).bare,
      ask: splitManagedPermissionKeys(parsed.projectPermissions?.ask).bare
    }
    const keys = [...new Set([params.subject.key, ...(params.lookupKeys ?? [])])]
    const onceDeny = permissionState.onceDeny
    const matchedOnceDeny = onceDeny.filter(key => keys.includes(key))
    if (matchedOnceDeny.length > 0) {
      parsed.permissionState = {
        ...permissionState,
        onceDeny: onceDeny.filter(item => !matchedOnceDeny.includes(item))
      }
      await writeFile(
        resolvePermissionMirrorPath(params.cwd, params.adapter, params.sessionId),
        `${JSON.stringify(parsed, null, 2)}\n`,
        'utf8'
      )
      return 'deny' as const
    }
    const onceAllow = permissionState.onceAllow
    const matchedOnceAllow = onceAllow.filter(key => keys.includes(key))
    if (matchedOnceAllow.length > 0) {
      parsed.permissionState = {
        ...permissionState,
        onceAllow: onceAllow.filter(item => !matchedOnceAllow.includes(item))
      }
      await writeFile(
        resolvePermissionMirrorPath(params.cwd, params.adapter, params.sessionId),
        `${JSON.stringify(parsed, null, 2)}\n`,
        'utf8'
      )
      return 'allow' as const
    }
    if (keys.some(key => permissionState.deny.includes(key) || projectPermissions.deny.includes(key))) {
      return 'deny' as const
    }
    if (keys.some(key => permissionState.allow.includes(key) || projectPermissions.allow.includes(key))) {
      return 'allow' as const
    }
  } catch {
  }

  return 'inherit' as const
}

const postPermissionCheck = async (params: {
  host: string
  port: string
  sessionId: string
  adapter: string
  toolName?: string
  toolInput?: unknown
}) => {
  const response = await fetch(`http://${params.host}:${params.port}/api/interact/permission-check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId: params.sessionId,
      adapter: params.adapter,
      toolName: params.toolName,
      toolInput: params.toolInput
    })
  })

  if (!response.ok) {
    throw new Error(`permission-check failed with ${response.status}`)
  }

  return await response.json() as PermissionCheckResponse
}

const buildDenyOutput = (
  subject: PermissionToolSubject | undefined
): HookOutputs['PreToolUse'] => ({
  continue: false,
  stopReason: subject?.label != null && subject.label !== ''
    ? `Permission denied for ${subject.label}`
    : 'Permission denied by remembered rule',
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: subject?.label != null && subject.label !== ''
      ? `Remembered deny rule for ${subject.label}`
      : 'Remembered deny rule'
  }
})

const buildAllowOutput = (
  subject: PermissionToolSubject | undefined
): HookOutputs['PreToolUse'] => ({
  continue: true,
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'allow',
    permissionDecisionReason: subject?.label != null && subject.label !== ''
      ? `Remembered allow rule for ${subject.label}`
      : 'Remembered allow rule'
  }
})

export const createBuiltinPermissionPlugin = (
  env: Record<string, string | null | undefined>
): Partial<Plugin> =>
  definePlugin({
    name: 'builtin-permissions',
    PreToolUse: async (_ctx, input, next) => {
      if (input.hookSource !== 'native' || input.canBlock === false) {
        return next()
      }
      if (
        input.adapter !== 'claude-code' &&
        input.adapter !== 'gemini' &&
        input.adapter !== 'kimi' &&
        input.adapter !== 'opencode'
      ) {
        return next()
      }

      const host = env.__VF_PROJECT_AI_SERVER_HOST__?.trim()
      const port = env.__VF_PROJECT_AI_SERVER_PORT__?.trim()
      const sessionId = input.sessionId.trim()
      const adapter = input.adapter
      const { subject, lookupKeys } = resolvePermissionToolContext(input.toolName, {
        toolInput: input.toolInput
      })

      try {
        if (host != null && host !== '' && port != null && port !== '') {
          const result = await postPermissionCheck({
            host,
            port,
            sessionId,
            adapter,
            toolName: input.toolName,
            toolInput: input.toolInput
          })
          if (result.result === 'deny') {
            return buildDenyOutput(result.subject)
          }
          if (result.result === 'allow') {
            return buildAllowOutput(result.subject)
          }
        }
      } catch {
      }

      if (subject == null) {
        return next()
      }

      const fallback = await readMirrorDecision({
        cwd: input.cwd,
        adapter,
        sessionId,
        subject,
        lookupKeys
      })
      if (fallback === 'deny') {
        return buildDenyOutput(subject)
      }
      if (fallback === 'allow') {
        return buildAllowOutput(subject)
      }

      return next()
    }
  })
