import type { BenchmarkResult, BenchmarkRunSummary } from '@vibe-forge/core'

// ─── Formatting ───────────────────────────────────────────────────────────────

export const isTerminalRun = (run?: BenchmarkRunSummary | null) =>
  run?.status === 'completed' || run?.status === 'failed'

export const formatTimestamp = (value?: string | null): string => {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

// ─── Result status helpers ────────────────────────────────────────────────────

export const getResultStatusMeta = (result?: BenchmarkResult | null) => {
  if (result == null) return { icon: 'radio_button_unchecked', statusKey: 'no-result' }
  if (result.status === 'pass') return { icon: 'check_circle', statusKey: 'pass' }
  if (result.status === 'partial') return { icon: 'rule', statusKey: 'partial' }
  return { icon: 'cancel', statusKey: 'fail' }
}

