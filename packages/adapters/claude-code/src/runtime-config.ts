import { resolveAdapterConfig as resolveMergedAdapterConfig } from '@vibe-forge/config'
import type { AdapterCtx } from '@vibe-forge/types'

import type { ClaudeCodeAdapterConfig } from './config-schema.js'
import { claudeCodeAdapterDeepMergeKeys, claudeCodeAdapterExtraCommonKeys } from './config-schema.js'

export const resolveClaudeCodeAdapterConfig = (
  params: Pick<AdapterCtx, 'configState' | 'configs'>
) => resolveMergedAdapterConfig<ClaudeCodeAdapterConfig, typeof claudeCodeAdapterExtraCommonKeys[number]>(
  'claude-code',
  params,
  {
    extraCommonKeys: claudeCodeAdapterExtraCommonKeys,
    deepMergeKeys: claudeCodeAdapterDeepMergeKeys
  }
)
