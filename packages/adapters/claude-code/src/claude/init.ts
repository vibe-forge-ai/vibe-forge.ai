import type { AdapterCtx } from '@vibe-forge/types'
import { ensureClaudeNativeHooksInstalled } from '../hooks/native'

export const initClaudeCodeAdapter = async (ctx: AdapterCtx) => {
  await ensureClaudeNativeHooksInstalled(ctx)
}
