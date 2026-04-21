import type { ChatMessageContent } from '@vibe-forge/core'

export type SenderVariant = 'default' | 'inline-edit'

export type SenderInitialContent = string | ChatMessageContent[] | undefined

export type SenderSubmitResult = boolean | void

export type ReferenceMenuKey = 'image' | 'file'

export interface RovingFocusNavigation<T extends string> {
  activeKey: T | null
  setActiveKey: (key: T | null) => void
  registerItem: (key: T) => (node: HTMLElement | null) => void
  focusKey: (key: T | null) => void
  moveFocus: (delta: number, fromKey?: T | null) => T | null
  focusFirst: () => T | null
  focusLast: () => T | null
}
