import { Buffer } from 'node:buffer'
import process from 'node:process'

import type { HookInput } from '@vibe-forge/core/hooks'
import { transformCamelKey } from '@vibe-forge/core/utils/string-transform'

export let hookInput: HookInput

export const setHookInput = async () => {
  const stdoutBuffer = await new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = []
    process.stdin.on('data', (chunk) => chunks.push(chunk))
    process.stdin.once('end', () => resolve(Buffer.concat(chunks)))
  })
  hookInput = transformCamelKey<HookInput>(
    JSON.parse(stdoutBuffer.toString() ?? '{}')
  )
}
