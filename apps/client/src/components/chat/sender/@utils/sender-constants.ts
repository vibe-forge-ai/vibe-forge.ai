import type { ChatEffort } from '#~/hooks/chat/use-chat-effort'
import type { PermissionMode } from '#~/hooks/chat/use-chat-permission-mode'

export const effortIconMap: Record<ChatEffort, string> = {
  default: 'auto_awesome',
  low: 'signal_cellular_alt_1_bar',
  medium: 'signal_cellular_alt_2_bar',
  high: 'signal_cellular_alt',
  max: 'bolt'
}

export const permissionModeIconMap: Record<PermissionMode, string> = {
  default: 'tune',
  acceptEdits: 'edit_note',
  plan: 'checklist',
  dontAsk: 'verified_user',
  bypassPermissions: 'gpp_bad'
}
