export const adapterDisplayMap = {
  'claude-code': {
    title: 'Claude Code',
    icon: undefined
  },
  codex: {
    title: 'Codex',
    icon: undefined
  },
  copilot: {
    title: 'Copilot',
    icon: undefined
  },
  gemini: {
    title: 'Gemini',
    icon: undefined
  },
  kimi: {
    title: 'Kimi',
    icon: undefined
  },
  opencode: {
    title: 'OpenCode',
    icon: undefined
  }
} as const

export const getAdapterDisplay = (adapterKey: string) => {
  return adapterDisplayMap[adapterKey as keyof typeof adapterDisplayMap] ?? {
    title: adapterKey,
    icon: undefined
  }
}
