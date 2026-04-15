import type { WorkspaceAssetAdapter } from '@vibe-forge/types'

const NATIVE_SKILL_ADAPTERS = new Set<WorkspaceAssetAdapter>(['claude-code', 'gemini', 'opencode'])

export const supportsNativeProjectSkills = (adapter?: string): adapter is WorkspaceAssetAdapter =>
  adapter != null && NATIVE_SKILL_ADAPTERS.has(adapter as WorkspaceAssetAdapter)

export const resolveNativeSkillDiagnosticReason = (adapter: WorkspaceAssetAdapter) => (
  adapter === 'claude-code'
    ? 'Synced into the Claude mock home as a native skill.'
    : adapter === 'gemini'
    ? 'Symlinked into GEMINI_CLI_HOME as a native Gemini skill.'
    : 'Mirrored into OPENCODE_CONFIG_DIR as a native skill.'
)
