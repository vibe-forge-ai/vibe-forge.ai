import { atom } from 'jotai'

// 侧边栏宽度
export const sidebarWidthAtom = atom(
  Number(localStorage.getItem('sidebarWidth')) || 300
)

// 侧边栏是否正在缩放
export const isSidebarResizingAtom = atom<boolean>(false)

// 侧边栏是否折叠
export const isSidebarCollapsedAtom = atom(false)

export const isMobileSidebarOpenAtom = atom(false)

// 当前选中的会话 ID (全局 UI 状态，用于控制高亮等)
export const activeSessionIdAtom = atom<string | undefined>(undefined)

// 主题模式: 'light' | 'dark' | 'system'
export type ThemeMode = 'light' | 'dark' | 'system'
export const themeAtom = atom<ThemeMode>(
  (localStorage.getItem('theme') as ThemeMode) || 'system'
)

export type SenderHeaderDisplayMode = 'expanded' | 'collapsed'

const SENDER_HEADER_DISPLAY_STORAGE_KEY = 'vf_sender_header_default_display'

const isSenderHeaderDisplayMode = (
  value: string
): value is SenderHeaderDisplayMode => {
  return value === 'expanded' || value === 'collapsed'
}

const getStoredSenderHeaderDisplayMode = (): SenderHeaderDisplayMode => {
  try {
    const raw = localStorage.getItem(SENDER_HEADER_DISPLAY_STORAGE_KEY)
    if (raw != null && isSenderHeaderDisplayMode(raw)) {
      return raw
    }
  } catch {}

  return 'expanded'
}

const senderHeaderDisplayBaseAtom = atom<SenderHeaderDisplayMode>(
  getStoredSenderHeaderDisplayMode()
)

export const senderHeaderDisplayAtom = atom(
  get => get(senderHeaderDisplayBaseAtom),
  (_get, set, value: SenderHeaderDisplayMode) => {
    const nextValue = isSenderHeaderDisplayMode(value)
      ? value
      : 'expanded'

    set(senderHeaderDisplayBaseAtom, nextValue)

    try {
      localStorage.setItem(SENDER_HEADER_DISPLAY_STORAGE_KEY, nextValue)
    } catch {}
  }
)

export const showAnnouncementsAtom = atom(true)
