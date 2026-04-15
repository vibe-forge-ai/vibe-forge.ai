import {
  adapterDisplayName as claudeCodeDisplayName,
  adapterIcon as claudeCodeIcon
} from '@vibe-forge/adapter-claude-code/icon'
import { adapterDisplayName as codexDisplayName, adapterIcon as codexIcon } from '@vibe-forge/adapter-codex/icon'
import { adapterDisplayName as copilotDisplayName, adapterIcon as copilotIcon } from '@vibe-forge/adapter-copilot/icon'
import {
  adapterDisplayName as geminiDisplayName,
  adapterIcon as geminiIcon
} from '@vibe-forge/adapter-gemini/icon'
import { adapterDisplayName as kimiDisplayName, adapterIcon as kimiIcon } from '@vibe-forge/adapter-kimi/icon'
import {
  adapterDisplayName as opencodeDisplayName,
  adapterIcon as opencodeIcon
} from '@vibe-forge/adapter-opencode/icon'

export const adapterDisplayMap = {
  'claude-code': {
    title: claudeCodeDisplayName,
    icon: claudeCodeIcon
  },
  codex: {
    title: codexDisplayName,
    icon: codexIcon
  },
  copilot: {
    title: copilotDisplayName,
    icon: copilotIcon
  },
  gemini: {
    title: geminiDisplayName,
    icon: geminiIcon
  },
  kimi: {
    title: kimiDisplayName,
    icon: kimiIcon
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
