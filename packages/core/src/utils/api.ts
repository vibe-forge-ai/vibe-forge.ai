import process from 'node:process'

import type { HookInputs, HookOutputs } from '#~/hooks/type.js'

export type HookEventName = keyof HookInputs

type HookInputPayload<K extends HookEventName> = Omit<HookInputs[K], 'hookEventName'>

const host = process.env.__VF_PROJECT_AI_SERVER_HOST__ ?? 'localhost'
const port = process.env.__VF_PROJECT_AI_SERVER_PORT__ ?? '8787'
const baseUrl = `http://${host}:${port}`

export const callHook = async <K extends HookEventName>(
  hookEventName: K,
  input: HookInputPayload<K>,
  env: Record<string, unknown> = process.env
): Promise<HookOutputs[K]> => {
  const response = await fetch(`${baseUrl}/api/hooks/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hookEventName,
      input,
      env
    })
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to call hook: ${response.statusText} - ${errorText}`)
  }
  return response.json()
}
