import {
  adapterDisplayName as claudeCodeDisplayName,
  adapterIcon as claudeCodeIcon
} from '@vibe-forge/adapter-claude-code/icon'
import { adapterDisplayName as codexDisplayName, adapterIcon as codexIcon } from '@vibe-forge/adapter-codex/icon'
import {
  adapterDisplayName as opencodeDisplayName,
  adapterIcon as opencodeIcon
} from '@vibe-forge/adapter-opencode/icon'
import {
  adapterDisplayName as geminiDisplayName,
  adapterIcon as geminiIcon
} from '@vibe-forge/adapter-gemini/icon'

export const adapterDisplayMap = {
  'claude-code': {
    title: claudeCodeDisplayName,
    icon: claudeCodeIcon
  },
  codex: {
    title: codexDisplayName,
    icon: codexIcon
  },
  gemini: {
    title: geminiDisplayName,
    icon: geminiIcon
  },
  opencode: {
    title: opencodeDisplayName,
    icon: opencodeIcon
  }
} as const

export const getAdapterDisplay = (adapterKey: string) => {
  return adapterDisplayMap[adapterKey as keyof typeof adapterDisplayMap] ?? {
    title: adapterKey,
    icon: undefined
  }
}
