import { atom } from 'jotai'

// 侧边栏宽度
export const sidebarWidthAtom = atom(
  Number(localStorage.getItem('sidebarWidth')) || 300
)

// 侧边栏是否正在缩放
export const isSidebarResizingAtom = atom<boolean>(false)

// 侧边栏是否折叠
export const isSidebarCollapsedAtom = atom(
  localStorage.getItem('sidebarCollapsed') === 'true'
)

// 当前选中的会话 ID (全局 UI 状态，用于控制高亮等)
export const activeSessionIdAtom = atom<string | undefined>(undefined)

// 主题模式: 'light' | 'dark' | 'system'
export type ThemeMode = 'light' | 'dark' | 'system'
export const themeAtom = atom<ThemeMode>(
  (localStorage.getItem('theme') as ThemeMode) || 'system'
)
