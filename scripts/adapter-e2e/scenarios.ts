import path from 'node:path'

import { mockClaudeService, mockModelService, repoRoot } from './runtime'
import type { AdapterE2ETarget, ManagedArtifactDefinition } from './types'

const codexPrompt = 'Use the Read tool exactly once on README.md, then reply with exactly E2E_CODEX and nothing else.'
const claudePrompt = 'Use the Read tool exactly once on README.md, then reply with exactly E2E_CLAUDE and nothing else.'
const opencodePrompt =
  'Use the read tool exactly once on README.md, then reply with exactly E2E_OPENCODE and nothing else.'

export const ADAPTER_E2E_TARGETS: AdapterE2ETarget[] = [
  'codex',
  'claude-code',
  'opencode'
]

export const ADAPTER_E2E_DEFAULTS: Record<AdapterE2ETarget, {
  finalOutput: string
  model: string
  prompt: string
}> = {
  codex: {
    finalOutput: 'E2E_CODEX',
    model: `${mockModelService},codex-hooks`,
    prompt: codexPrompt
  },
  'claude-code': {
    finalOutput: 'E2E_CLAUDE',
    model: `${mockClaudeService},claude-hooks`,
    prompt: claudePrompt
  },
  opencode: {
    finalOutput: 'E2E_OPENCODE',
    model: `${mockModelService},opencode-hooks`,
    prompt: opencodePrompt
  }
}

export const MANAGED_ARTIFACTS: Record<AdapterE2ETarget, ManagedArtifactDefinition[]> = {
  codex: [
    {
      label: 'codex hooks config',
      candidates: [
        {
          path: path.resolve(repoRoot, '.ai/.mock/.codex/hooks.json'),
          includes: ['call-hook.js', 'PreToolUse', 'PostToolUse', 'SessionStart', 'UserPromptSubmit', 'Stop']
        }
      ]
    }
  ],
  'claude-code': [
    {
      label: 'claude managed settings',
      candidates: [
        {
          path: path.resolve(repoRoot, '.ai/.mock/.claude/settings.json'),
          includes: ['"hooks"']
        }
      ]
    }
  ],
  opencode: [
    {
      label: 'opencode global config',
      candidates: [
        {
          path: path.resolve(repoRoot, '.ai/.mock/.config/opencode/opencode.json'),
          includes: ['https://opencode.ai/config.json']
        }
      ]
    },
    {
      label: 'opencode managed plugin',
      candidates: [
        {
          path: path.resolve(repoRoot, '.ai/.mock/.config/opencode/plugins/vibe-forge-hooks.js'),
          includes: ['VibeForgeHooks', 'call-hook.js', 'tool.execute.before', 'tool.execute.after']
        }
      ]
    },
    {
      label: 'opencode session config',
      candidates: [
        {
          path: path.resolve(repoRoot, '.ai/.mock/.opencode-adapter', ':sessionId', 'config-dir', 'opencode.json'),
          includes: ['"provider"', 'hook-smoke-mock']
        }
      ]
    }
  ]
}
