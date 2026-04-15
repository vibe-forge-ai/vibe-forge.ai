import type {
  AdapterErrorData,
  AskUserQuestionParams,
  PermissionInteractionContext,
  PermissionInteractionDecision,
  SessionPermissionMode
} from '@vibe-forge/types'
import { normalizePermissionToolName } from '@vibe-forge/utils'
import type { PermissionToolSubject } from '@vibe-forge/utils'

export { applyTaskPermissionDecision, syncTaskPermissionStateMirror } from './permission-state'

const PERMISSION_PROJECT_CONFIG_PATH = '.ai.config.json'
export const PERMISSION_DECISION_CANCEL = 'cancel'

const uniqueStrings = (values: string[]) => [...new Set(values)]

const normalizeKeys = (values: string[]) =>
  uniqueStrings(
    values
      .map((value) => normalizePermissionToolName(value)?.key ?? value.trim())
      .filter((value): value is string => value.trim() !== '')
  )

const buildPermissionOption = (
  label: string,
  value: PermissionInteractionDecision,
  description: string
) => ({ label, value, description })

const resolvePermissionToolSubject = (value: string): PermissionToolSubject | undefined => (
  normalizePermissionToolName(value)
)

export interface PermissionErrorContext {
  subjectKeys: string[]
  deniedTools: string[]
  reasons: string[]
}

export const extractPermissionErrorContext = (error: AdapterErrorData): PermissionErrorContext => {
  const details = error.details != null && typeof error.details === 'object'
    ? error.details as Record<string, unknown>
    : {}
  const rawDeniedTools = new Set<string>()
  const reasons = new Set<string>()

  const permissionDenials = Array.isArray(details.permissionDenials) ? details.permissionDenials : []
  for (const denial of permissionDenials) {
    if (denial == null || typeof denial !== 'object') continue
    const record = denial as Record<string, unknown>
    if (typeof record.message === 'string' && record.message.trim() !== '') {
      reasons.add(record.message.trim())
    }
    if (Array.isArray(record.deniedTools)) {
      for (const tool of record.deniedTools) {
        if (typeof tool === 'string' && tool.trim() !== '') {
          rawDeniedTools.add(tool.trim())
        }
      }
    }
  }

  if (Array.isArray(details.deniedTools)) {
    for (const tool of details.deniedTools) {
      if (typeof tool === 'string' && tool.trim() !== '') {
        rawDeniedTools.add(tool.trim())
      }
    }
  }

  if (typeof details.toolName === 'string' && details.toolName.trim() !== '') {
    rawDeniedTools.add(details.toolName.trim())
  }

  if (typeof error.message === 'string' && error.message.trim() !== '') {
    reasons.add(error.message.trim())
  }

  const deniedTools = [...rawDeniedTools]
  const subjectKeys = uniqueStrings(
    deniedTools
      .map(tool => resolvePermissionToolSubject(tool)?.key)
      .filter((key): key is string => key != null && key.trim() !== '')
  )

  return {
    subjectKeys,
    deniedTools,
    reasons: [...reasons]
  }
}

export const resolvePermissionInteractionDecision = (
  answer: string | string[]
): PermissionInteractionDecision | typeof PERMISSION_DECISION_CANCEL | undefined => {
  const normalizedAnswer = Array.isArray(answer) ? answer[0] : answer
  if (typeof normalizedAnswer !== 'string') return undefined

  const raw = normalizedAnswer.trim()
  if (raw === '') return undefined
  if (raw === PERMISSION_DECISION_CANCEL) return PERMISSION_DECISION_CANCEL

  if (
    raw === 'allow_once' ||
    raw === 'allow_session' ||
    raw === 'allow_project' ||
    raw === 'deny_once' ||
    raw === 'deny_session' ||
    raw === 'deny_project'
  ) {
    return raw
  }

  return undefined
}

export const buildPermissionRecoveryPayload = (params: {
  sessionId: string
  adapter?: string
  currentMode?: SessionPermissionMode
  context: PermissionErrorContext
}): AskUserQuestionParams | undefined => {
  const subjectKeys = normalizeKeys(params.context.subjectKeys)
  if (subjectKeys.length === 0) {
    return undefined
  }

  const primarySubjectKey = subjectKeys[0] ?? 'UnknownTool'
  const subjectLabel = subjectKeys.length <= 1
    ? primarySubjectKey
    : `${subjectKeys[0]} 等 ${subjectKeys.length} 项工具`
  const deniedTools = uniqueStrings([
    ...params.context.deniedTools,
    ...subjectKeys
  ])
  const permissionContext: PermissionInteractionContext = {
    adapter: params.adapter,
    currentMode: params.currentMode,
    deniedTools,
    reasons: uniqueStrings(params.context.reasons),
    subjectKey: primarySubjectKey,
    subjectLabel,
    scope: 'tool',
    projectConfigPath: PERMISSION_PROJECT_CONFIG_PATH
  }

  return {
    sessionId: params.sessionId,
    kind: 'permission',
    question: subjectKeys.length <= 1
      ? `当前任务需要使用 ${subjectLabel} 才能继续，请选择处理方式。`
      : `当前任务涉及 ${subjectKeys.join('、')} 等工具，请选择处理方式。`,
    options: [
      buildPermissionOption('同意本次', 'allow_once', '仅继续这次被拦截的操作。'),
      buildPermissionOption('同意并在当前会话忽略类似调用', 'allow_session', '本会话内同类工具不再重复询问。'),
      buildPermissionOption(
        '同意并在当前项目忽略类似调用',
        'allow_project',
        `写入 ${PERMISSION_PROJECT_CONFIG_PATH}，后续新会话仍生效。`
      ),
      buildPermissionOption('拒绝本次', 'deny_once', '拒绝当前这次操作。'),
      buildPermissionOption('拒绝并在当前会话阻止类似调用', 'deny_session', '本会话内同类工具直接拒绝。'),
      buildPermissionOption(
        '拒绝并在当前项目阻止类似调用',
        'deny_project',
        `写入 ${PERMISSION_PROJECT_CONFIG_PATH}，后续新会话仍生效。`
      )
    ],
    permissionContext
  }
}
