import { resolveAdapterConfigWithContribution as resolveMergedAdapterConfig } from '@vibe-forge/config'
import type { AdapterConfigEntry, AdapterCtx } from '@vibe-forge/types'

import { adapterConfigContribution } from './config-schema.js'
import type { ClaudeCodeAdapterConfig } from './config-schema.js'

export const resolveClaudeCodeAdapterConfig = (
  params: Pick<AdapterCtx, 'configState' | 'configs'>
) => resolveMergedAdapterConfig<AdapterConfigEntry<ClaudeCodeAdapterConfig>>(
  adapterConfigContribution,
  params
)
