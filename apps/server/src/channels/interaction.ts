import type { AskUserQuestionParams } from '@vibe-forge/core'

type InteractionOption = NonNullable<AskUserQuestionParams['options']>[number]
type InteractionKind = AskUserQuestionParams['kind']

const isEnglish = (language: string) => language === 'en'

export const splitInteractionSelections = (value: string) =>
  value
    .split(/[\n,，、]+/g)
    .map(item => item.trim())
    .filter(Boolean)

export const normalizeInteractionToken = (value: string) =>
  value
    .trim()
    .replace(/^[`"'“”‘’([]+|[`"'“”‘’)\].,，。!！?？:：；;]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()

export const formatInteractionChoices = (options: InteractionOption[]) =>
  options
    .map((option, index) => `${index + 1}. ${option.label}`)
    .join('\n')

export const getInteractionResponseMode = (kind: InteractionKind) => {
  if (kind === 'permission') return 'controlled'
  return 'freeform'
}

export const resolveInteractionSelection = (
  rawSelection: string,
  options: InteractionOption[],
  input: {
    allowLooseMatch?: boolean
  } = {}
) => {
  const trimmed = rawSelection.trim()
  if (trimmed === '') return undefined

  const numeric = Number.parseInt(trimmed, 10)
  if (String(numeric) === trimmed && numeric >= 1 && numeric <= options.length) {
    const option = options[numeric - 1]!
    return option.value ?? option.label
  }

  const normalized = normalizeInteractionToken(trimmed)
  if (normalized === '') return undefined

  const exactMatched = options.find((option) => {
    const candidates = [option.label, option.value].filter((candidate): candidate is string =>
      (candidate?.trim() ?? '') !== ''
    )
    return candidates.some(candidate => normalizeInteractionToken(candidate) === normalized)
  })
  if (exactMatched) {
    return exactMatched.value ?? exactMatched.label
  }

  if (input.allowLooseMatch === false) {
    return undefined
  }

  const looseMatched = options.filter((option) => {
    const candidates = [option.label, option.value].filter((candidate): candidate is string =>
      (candidate?.trim() ?? '') !== ''
    )
    return candidates.some((candidate) => {
      const normalizedCandidate = normalizeInteractionToken(candidate)
      return normalizedCandidate !== '' && (
        normalizedCandidate.includes(normalized) ||
        normalized.includes(normalizedCandidate)
      )
    })
  })
  if (looseMatched.length === 1) {
    const option = looseMatched[0]!
    return option.value ?? option.label
  }

  return undefined
}

const buildInteractionOptionLines = (language: string, options: InteractionOption[]) => {
  if (options.length === 0) return []

  return [
    '',
    isEnglish(language) ? 'Options:' : '可选项：',
    ...options.map((option, index) => {
      const prefix = `${index + 1}. `
      if ((option.description?.trim() ?? '') === '') {
        return `${prefix}${option.label}`
      }
      return `${prefix}${option.label}: ${option.description}`
    })
  ]
}

const buildInteractionInstruction = (
  language: string,
  input: {
    hasOptions: boolean
    multiselect: boolean
    kind: InteractionKind
  }
) => {
  const controlled = input.kind === 'permission'

  if (input.multiselect) {
    if (isEnglish(language)) {
      return controlled
        ? 'Multiple selections are allowed. Reply with option labels or numbers, separated by commas or new lines.'
        : 'Multiple selections are allowed. You can reply with option labels or numbers, separated by commas or new lines, or answer freely in plain text.'
    }
    return controlled
      ? '支持多选，请直接回复选项文本或序号；多个选项可用逗号、顿号或换行分隔。'
      : '支持多选，可以回复选项文本或序号；多个选项可用逗号、顿号或换行分隔，也可以直接自由输入答案。'
  }

  if (input.hasOptions) {
    if (isEnglish(language)) {
      return controlled
        ? 'Reply with the option label or number, or tap a quick action if one is shown below.'
        : 'Reply with the option label or number, tap a quick action if one is shown below, or answer freely in plain text.'
    }
    return controlled
      ? '请直接回复选项文本或序号；如果下方出现快捷气泡，也可以直接点击。'
      : '可以回复选项文本或序号；如果下方出现快捷气泡，也可以直接点击，也可以直接自由输入答案。'
  }

  return isEnglish(language) ? 'Please reply directly in plain text.' : '请直接回复文字内容。'
}

export const buildInteractionText = (
  language: string,
  payload: AskUserQuestionParams
) => {
  const permissionContext = payload.kind === 'permission' ? payload.permissionContext : undefined
  const permissionReasons = permissionContext?.reasons ?? []
  const lines = [
    ...(payload.kind === 'permission'
      ? [isEnglish(language) ? '[Permission Request]' : '[权限请求]']
      : []),
    payload.question.trim()
  ]

  if ((permissionContext?.currentMode ?? '').trim() !== '') {
    lines.push(
      isEnglish(language)
        ? `Current mode: ${permissionContext?.currentMode}`
        : `当前模式：${permissionContext?.currentMode}`
    )
  }
  if ((permissionContext?.suggestedMode ?? '').trim() !== '') {
    lines.push(
      isEnglish(language)
        ? `Suggested mode: ${permissionContext?.suggestedMode}`
        : `建议模式：${permissionContext?.suggestedMode}`
    )
  }
  if (permissionReasons.length > 0) {
    lines.push(isEnglish(language) ? 'Reason:' : '原因：')
    lines.push(...permissionReasons.map(reason => `- ${reason}`))
  }

  lines.push(...buildInteractionOptionLines(language, payload.options ?? []))
  lines.push('')
  lines.push(buildInteractionInstruction(language, {
    hasOptions: (payload.options?.length ?? 0) > 0,
    multiselect: payload.multiselect ?? false,
    kind: payload.kind
  }))

  return lines.join('\n')
}
