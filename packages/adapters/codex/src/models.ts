import type { AdapterBuiltinModel } from '@vibe-forge/types'

/**
 * Codex native model options.
 * These models are supported directly by the `codex` CLI binary
 * and do not require model-service routing.
 *
 * Recommended models (top-tier):
 *   gpt-5.4, gpt-5.3-codex, gpt-5.3-codex-spark
 *
 * Alternative models:
 *   gpt-5.2-codex, gpt-5.2, gpt-5.1-codex-max, gpt-5.1, gpt-5.1-codex,
 *   gpt-5-codex, gpt-5-codex-mini, gpt-5
 */
export const builtinModels: AdapterBuiltinModel[] = [
  // ── Recommended ───────────────────────────────────────────────
  {
    value: 'gpt-5.4',
    title: 'GPT-5.4',
    description: 'Flagship frontier model for professional work with industry-leading coding capabilities'
  },
  {
    value: 'gpt-5.3-codex',
    title: 'GPT-5.3-Codex',
    description: 'Industry-leading coding model for complex software engineering'
  },
  {
    value: 'gpt-5.3-codex-spark',
    title: 'GPT-5.3-Codex-Spark',
    description: 'Text-only research preview model optimized for near-instant, real-time coding iteration'
  },
  // ── Alternative ───────────────────────────────────────────────
  {
    value: 'gpt-5.2-codex',
    title: 'GPT-5.2-Codex',
    description: 'Advanced coding model for real-world engineering'
  },
  {
    value: 'gpt-5.2',
    title: 'GPT-5.2',
    description: 'Previous general-purpose model for coding and agentic tasks'
  },
  {
    value: 'gpt-5.1-codex-max',
    title: 'GPT-5.1-Codex-Max',
    description: 'Optimized for long-horizon, agentic coding tasks in Codex'
  },
  {
    value: 'gpt-5.1',
    title: 'GPT-5.1',
    description: 'Great for coding and agentic tasks across domains'
  },
  {
    value: 'gpt-5.1-codex',
    title: 'GPT-5.1-Codex',
    description: 'Optimized for long-running, agentic coding tasks in Codex'
  },
  {
    value: 'gpt-5-codex',
    title: 'GPT-5-Codex',
    description: 'Version of GPT-5 tuned for long-running, agentic coding tasks'
  },
  {
    value: 'gpt-5-codex-mini',
    title: 'GPT-5-Codex-Mini',
    description: 'Smaller, more cost-effective version of GPT-5-Codex'
  },
  {
    value: 'gpt-5',
    title: 'GPT-5',
    description: 'Reasoning model for coding and agentic tasks across domains'
  }
]
