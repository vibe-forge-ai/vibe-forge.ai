import { resolveAdapterConfigWithContribution as resolveMergedAdapterConfig } from '@vibe-forge/config'
import type { AdapterCtx } from '@vibe-forge/types'

import { adapterConfigContribution } from './config-schema.js'
import type { ClaudeCodeAdapterConfig, ClaudeCodeCommonAdapterConfigKey } from './config-schema.js'

export const resolveClaudeCodeAdapterConfig = (
  params: Pick<AdapterCtx, 'configState' | 'configs'>
) =>
  resolveMergedAdapterConfig<ClaudeCodeAdapterConfig, ClaudeCodeCommonAdapterConfigKey>(
    adapterConfigContribution,
    params
  )
