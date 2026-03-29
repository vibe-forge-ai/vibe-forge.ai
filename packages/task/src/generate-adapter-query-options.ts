import process from 'node:process'

import type { AdapterQueryOptions } from '@vibe-forge/types'
import { resolvePromptAssetSelection, resolveWorkspaceAssetBundle } from '@vibe-forge/workspace-assets'

export async function generateAdapterQueryOptions(
  type: 'spec' | 'entity' | undefined,
  name?: string,
  cwd: string = process.cwd(),
  input?: {
    skills?: AdapterQueryOptions['skills']
  }
) {
  const bundle = await resolveWorkspaceAssetBundle({ cwd })
  const [data, resolvedOptions] = await resolvePromptAssetSelection({
    bundle,
    type,
    name,
    input
  })
  return [
    data,
    resolvedOptions as Partial<AdapterQueryOptions>
  ] as const
}
