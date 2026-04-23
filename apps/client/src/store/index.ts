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

const THEME_STORAGE_KEY = 'theme'

const isThemeMode = (value: string): value is ThemeMode => {
  return value === 'light' || value === 'dark' || value === 'system'
}

const getStoredThemeMode = (): ThemeMode => {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw != null && isThemeMode(raw)) {
      return raw
    }
  } catch {}

  return 'system'
}

const themeBaseAtom = atom<ThemeMode>(getStoredThemeMode())

export const themeAtom = atom(
  get => get(themeBaseAtom),
  (_get, set, value: ThemeMode) => {
    const nextValue = isThemeMode(value)
      ? value
      : 'system'

    set(themeBaseAtom, nextValue)

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextValue)
    } catch {}
  }
)

const getStoredBoolean = (key: string, defaultValue: boolean) => {
  try {
    const raw = localStorage.getItem(key)
    if (raw === 'true') return true
    if (raw === 'false') return false
  } catch {}

  return defaultValue
}

const createStoredBooleanAtom = (storageKey: string, defaultValue: boolean) => {
  const baseAtom = atom<boolean>(getStoredBoolean(storageKey, defaultValue))

  return atom(
    get => get(baseAtom),
    (_get, set, value: boolean) => {
      const nextValue = value === true
      set(baseAtom, nextValue)

      try {
        localStorage.setItem(storageKey, String(nextValue))
      } catch {}
    }
  )
}

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

const SHOW_ANNOUNCEMENTS_STORAGE_KEY = 'vf_show_announcements'
const SHOW_NEW_SESSION_STARTER_LIST_STORAGE_KEY = 'vf_show_new_session_starter_list'

export const showAnnouncementsAtom = createStoredBooleanAtom(
  SHOW_ANNOUNCEMENTS_STORAGE_KEY,
  true
)

export const showNewSessionStarterListAtom = createStoredBooleanAtom(
  SHOW_NEW_SESSION_STARTER_LIST_STORAGE_KEY,
  true
)
