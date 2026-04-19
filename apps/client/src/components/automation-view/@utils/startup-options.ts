import type { EffortLevel, SessionPermissionMode } from '@vibe-forge/types'

export const DEFAULT_SELECT_VALUE = ''

export const DEFAULT_STARTUP_FORM_VALUES = {
  model: DEFAULT_SELECT_VALUE,
  adapter: DEFAULT_SELECT_VALUE,
  effort: 'default',
  permissionMode: 'default',
  createWorktreeMode: 'default',
  branchAction: 'default',
  branchName: '',
  branchKind: 'local'
} as const

export const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim() !== ''
)

export const getEffortLabelKey = (effort: EffortLevel) => (
  `automation.effort${effort[0].toUpperCase()}${effort.slice(1)}`
)

export const getPermissionModeLabelKey = (permissionMode: Exclude<SessionPermissionMode, 'default'>) => (
  `automation.permission${permissionMode[0].toUpperCase()}${permissionMode.slice(1)}`
)
