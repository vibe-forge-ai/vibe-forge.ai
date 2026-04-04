import { useMemo } from 'react'

import type { Config } from '@vibe-forge/types'

import { useGlobalShortcut } from '../useGlobalShortcut'

type ComposerShortcutConfig = NonNullable<Config['shortcuts']>

export const composerControlShortcutDefaults = {
  switchModel: 'mod+shift+m',
  switchEffort: 'mod+t',
  switchPermissionMode: 'mod+p'
} satisfies Pick<ComposerShortcutConfig, 'switchModel' | 'switchEffort' | 'switchPermissionMode'>

export const resolveComposerControlShortcuts = (
  shortcuts?: Config['shortcuts']
) => {
  const resolveShortcut = (value: string | undefined, fallback: string) => {
    return value != null && value.trim() !== '' ? value : fallback
  }

  return {
    switchModel: resolveShortcut(shortcuts?.switchModel, composerControlShortcutDefaults.switchModel),
    switchEffort: resolveShortcut(shortcuts?.switchEffort, composerControlShortcutDefaults.switchEffort),
    switchPermissionMode: resolveShortcut(
      shortcuts?.switchPermissionMode,
      composerControlShortcutDefaults.switchPermissionMode
    )
  }
}

export const useComposerControlShortcuts = ({
  enabled = true,
  isMac,
  shortcuts,
  onSwitchModel,
  onSwitchEffort,
  onSwitchPermissionMode
}: {
  enabled?: boolean
  isMac: boolean
  shortcuts?: Config['shortcuts']
  onSwitchModel: (event: KeyboardEvent) => void
  onSwitchEffort: (event: KeyboardEvent) => void
  onSwitchPermissionMode: (event: KeyboardEvent) => void
}) => {
  const resolvedShortcuts = useMemo(() => resolveComposerControlShortcuts(shortcuts), [shortcuts])

  useGlobalShortcut({
    shortcut: resolvedShortcuts.switchModel,
    enabled,
    isMac,
    onTrigger: onSwitchModel
  })
  useGlobalShortcut({
    shortcut: resolvedShortcuts.switchEffort,
    enabled,
    isMac,
    onTrigger: onSwitchEffort
  })
  useGlobalShortcut({
    shortcut: resolvedShortcuts.switchPermissionMode,
    enabled,
    isMac,
    onTrigger: onSwitchPermissionMode
  })

  return resolvedShortcuts
}
