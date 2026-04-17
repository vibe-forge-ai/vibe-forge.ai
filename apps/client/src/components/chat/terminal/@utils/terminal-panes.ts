import type { TFunction } from 'i18next'

import type { TerminalShellKind } from '@vibe-forge/types'

export const DEFAULT_TERMINAL_ID = 'default'
export const TERMINAL_SHELL_KINDS: TerminalShellKind[] = ['default', 'zsh', 'bash', 'sh']

export interface TerminalPaneConfig {
  id: string
  title: string
  shellKind: TerminalShellKind
}

export type MoveTerminalPanePlacement = 'after' | 'before'

const buildTerminalTitle = (index: number, t: TFunction) => t('chat.terminal.paneTitle', { index })

export const getNextTerminalTitle = (panes: TerminalPaneConfig[], t: TFunction) => {
  const usedTitles = new Set(panes.map(pane => pane.title.trim()).filter(Boolean))
  for (let index = 1; index <= panes.length + 1; index += 1) {
    const title = buildTerminalTitle(index, t)
    if (!usedTitles.has(title)) {
      return title
    }
  }

  return buildTerminalTitle(panes.length + 1, t)
}

export const withFixedTerminalTitles = (panes: TerminalPaneConfig[], t: TFunction) => {
  const titledPanes: TerminalPaneConfig[] = []
  for (const pane of panes) {
    const title = pane.title.trim()
    titledPanes.push({
      ...pane,
      title: title === '' ? getNextTerminalTitle(titledPanes, t) : title
    })
  }

  return titledPanes
}

const isTerminalShellKind = (value: unknown): value is TerminalShellKind => (
  typeof value === 'string' && TERMINAL_SHELL_KINDS.includes(value as TerminalShellKind)
)

const normalizePane = (value: unknown): TerminalPaneConfig | null => {
  if (typeof value === 'string' && value.trim() !== '') {
    return { id: value.trim(), title: '', shellKind: 'default' }
  }

  if (value == null || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<TerminalPaneConfig>
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : ''
  if (id === '') {
    return null
  }

  return {
    id,
    title: typeof candidate.title === 'string' ? candidate.title : '',
    shellKind: isTerminalShellKind(candidate.shellKind) ? candidate.shellKind : 'default'
  }
}

export const normalizeTerminalPanes = (value: unknown): TerminalPaneConfig[] => {
  if (!Array.isArray(value)) {
    return [{ id: DEFAULT_TERMINAL_ID, title: '', shellKind: 'default' }]
  }

  const panes: TerminalPaneConfig[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const pane = normalizePane(item)
    if (pane == null || seen.has(pane.id)) {
      continue
    }

    panes.push(pane)
    seen.add(pane.id)
  }

  return panes.length > 0 ? panes : [{ id: DEFAULT_TERMINAL_ID, title: '', shellKind: 'default' }]
}

export const createTerminalPane = (
  shellKind: TerminalShellKind = 'default',
  title = ''
): TerminalPaneConfig => ({
  id: `term-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  title,
  shellKind
})

export const moveTerminalPane = (
  panes: TerminalPaneConfig[],
  sourceId: string,
  targetId: string,
  placement: MoveTerminalPanePlacement = 'before'
) => {
  const sourceIndex = panes.findIndex(item => item.id === sourceId)
  const targetIndex = panes.findIndex(item => item.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return panes
  }

  const nextPanes = [...panes]
  const [moved] = nextPanes.splice(sourceIndex, 1)
  if (moved == null) {
    return panes
  }

  const nextTargetIndex = nextPanes.findIndex(item => item.id === targetId)
  if (nextTargetIndex < 0) {
    return panes
  }

  nextPanes.splice(nextTargetIndex + (placement === 'after' ? 1 : 0), 0, moved)
  return nextPanes
}
