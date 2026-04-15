#!/usr/bin/env node

const { Buffer } = require('node:buffer')
const { spawnSync } = require('node:child_process')
const process = require('node:process')

const NODE_PATH = process.env.__VF_PROJECT_NODE_PATH__ || process.execPath
const CALL_HOOK_PATH = process.env.__VF_KIMI_CALL_HOOK_PATH__ || require.resolve('@vibe-forge/hooks/call-hook.js')
const SESSION_ID = process.env.__VF_KIMI_TASK_SESSION_ID__
const RUNTIME = process.env.__VF_KIMI_HOOK_RUNTIME__
const MODEL = process.env.__VF_KIMI_HOOK_MODEL__

const readStdin = async () => {
  const chunks = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

const parseJson = (value, fallback) => {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const firstString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return undefined
}

const canBlockEvent = (eventName) => (
  eventName === 'SessionStart' ||
  eventName === 'UserPromptSubmit' ||
  eventName === 'PreToolUse' ||
  eventName === 'PostToolUse'
)

const normalizePayload = (raw) => {
  const eventName = firstString(raw.hook_event_name, raw.hookEventName) || 'PreToolUse'
  const cwd = firstString(raw.cwd, process.env.__VF_PROJECT_WORKSPACE_FOLDER__, process.cwd()) || process.cwd()
  const payload = {
    ...raw,
    cwd,
    hookEventName: eventName,
    sessionId: firstString(SESSION_ID, raw.session_id, raw.sessionId) || 'kimi-session',
    adapter: 'kimi',
    runtime: RUNTIME,
    hookSource: 'native',
    canBlock: canBlockEvent(eventName)
  }

  if (eventName === 'SessionStart') {
    payload.source = firstString(raw.source) || 'startup'
    if (MODEL) payload.model = MODEL
  }
  if (eventName === 'PreToolUse' || eventName === 'PostToolUse') {
    payload.toolCallId = firstString(raw.tool_call_id, raw.toolCallId)
    payload.toolName = firstString(raw.tool_name, raw.toolName) || 'unknown'
    payload.toolInput = raw.tool_input ?? raw.toolInput
  }
  if (eventName === 'PostToolUse') {
    payload.toolResponse = raw.tool_output ?? raw.tool_response ?? raw.toolResponse
    payload.isError = Boolean(raw.is_error ?? raw.isError)
  }
  if (eventName === 'UserPromptSubmit') {
    payload.prompt = firstString(raw.prompt) || ''
  }
  if (eventName === 'Stop') {
    payload.stopHookActive = Boolean(raw.stop_hook_active ?? raw.stopHookActive)
  }

  return payload
}

const runVibeHook = (payload) => {
  const result = spawnSync(NODE_PATH, [CALL_HOOK_PATH], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: {
      ...process.env,
      __VF_PROJECT_WORKSPACE_FOLDER__: payload.cwd || process.env.__VF_PROJECT_WORKSPACE_FOLDER__ || process.cwd()
    }
  })

  if ((result.status ?? 0) !== 0) {
    console.error('[vibe-forge kimi hook] call-hook exited with', result.status, result.stderr)
    return { continue: true }
  }

  return parseJson(result.stdout?.trim() || '{}', { continue: true })
}

const blockReason = (result) => (
  firstString(
    result?.stopReason,
    result?.hookSpecificOutput?.permissionDecisionReason,
    result?.systemMessage
  ) || 'blocked by Vibe Forge hook'
)

const main = async () => {
  const raw = parseJson(await readStdin(), {})
  const payload = normalizePayload(raw)
  const result = runVibeHook(payload)
  const hookSpecificOutput = result?.hookSpecificOutput
  const permissionDecision = hookSpecificOutput?.permissionDecision

  if (permissionDecision === 'deny') {
    process.stdout.write(`${JSON.stringify({ hookSpecificOutput })}\n`)
    return
  }

  if (result?.continue === false) {
    if (payload.canBlock === false) {
      process.stderr.write(`${blockReason(result)}\n`)
      return
    }
    process.stderr.write(`${blockReason(result)}\n`)
    process.exit(2)
  }

  if (hookSpecificOutput != null) {
    process.stdout.write(`${JSON.stringify({ hookSpecificOutput })}\n`)
    return
  }

  const additionalContext = firstString(
    result?.hookSpecificOutput?.additionalContext,
    result?.systemMessage
  )
  if (additionalContext && result?.suppressOutput !== true) {
    process.stdout.write(`${additionalContext}\n`)
  }
}

main().catch((error) => {
  console.error('[vibe-forge kimi hook] failed', error)
  process.exit(0)
})
