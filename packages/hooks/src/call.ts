import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import process from 'node:process'

import { resolveManagedHookScriptPath } from './native'
import type { HookInputs, HookOutputs } from './type'

export type HookEventName = keyof HookInputs

type HookInputPayload<K extends HookEventName> = Omit<HookInputs[K], 'hookEventName'>

const pickHookEnv = (env: Record<string, unknown>): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      result[key] = value
    }
  }
  return result
}

export const callHook = async <K extends HookEventName>(
  hookEventName: K,
  input: HookInputPayload<K>,
  env: Record<string, unknown> = process.env
): Promise<HookOutputs[K]> => {
  const childEnv = pickHookEnv(env)
  childEnv.__VF_VIBE_FORGE_HOOK_EVENT_NAME__ = hookEventName
  const child = spawn(process.execPath, [resolveManagedHookScriptPath('call-hook.js')], {
    cwd: typeof input.cwd === 'string' ? input.cwd : process.cwd(),
    env: childEnv,
    stdio: ['pipe', 'pipe', 'pipe']
  })

  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []

  child.stdout.on('data', chunk => stdoutChunks.push(chunk))
  child.stderr.on('data', chunk => stderrChunks.push(chunk))

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', code => resolve(code ?? 0))
    child.stdin.end(JSON.stringify({
      ...input,
      hookEventName
    }))
  })

  const stdout = Buffer.concat(stdoutChunks).toString('utf-8').trim()
  const stderr = Buffer.concat(stderrChunks).toString('utf-8').trim()

  if (exitCode !== 0) {
    throw new Error(`Failed to call hook: process exited with code ${exitCode}${stderr ? ` - ${stderr}` : ''}`)
  }

  if (stdout === '') {
    return { continue: true } as HookOutputs[K]
  }

  try {
    return JSON.parse(stdout) as HookOutputs[K]
  } catch (error) {
    throw new Error(`Failed to parse hook output: ${stdout}${stderr ? `\nstderr: ${stderr}` : ''}`, { cause: error })
  }
}
