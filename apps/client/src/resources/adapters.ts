import { adapterDisplayName as claudeCodeDisplayName, adapterIcon as claudeCodeIcon } from '@vibe-forge/adapter-claude-code/icon'
import { adapterDisplayName as codexDisplayName, adapterIcon as codexIcon } from '@vibe-forge/adapter-codex/icon'

export const adapterDisplayMap = {
  'claude-code': {
    title: claudeCodeDisplayName,
    icon: claudeCodeIcon
  },
  codex: {
    title: codexDisplayName,
    icon: codexIcon
  }
} as const

export const getAdapterDisplay = (adapterKey: string) => {
  return adapterDisplayMap[adapterKey as keyof typeof adapterDisplayMap] ?? {
    title: adapterKey,
    icon: undefined
  }
}
