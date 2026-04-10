export type ClaudeToolFieldFormat = 'inline' | 'text' | 'code' | 'list' | 'json' | 'questions'

export interface ClaudeToolQuestionOption {
  label: string
  description?: string
}

export interface ClaudeToolQuestion {
  header?: string
  question: string
  options: ClaudeToolQuestionOption[]
  multiSelect: boolean
}

export interface ClaudeToolField {
  labelKey: string
  fallbackLabel: string
  format: ClaudeToolFieldFormat
  value: unknown
  lang?: string
}

export interface ClaudeToolPresentation {
  baseName: string
  titleKey: string
  fallbackTitle: string
  icon: string
  primary?: string
  fields: ClaudeToolField[]
}

export const CLAUDE_TOOL_META: Record<string, Pick<ClaudeToolPresentation, 'titleKey' | 'fallbackTitle' | 'icon'>> = {
  AskUserQuestion: { titleKey: 'chat.tools.askUserQuestion', fallbackTitle: 'Ask User Question', icon: 'help' },
  Bash: { titleKey: 'chat.tools.bash', fallbackTitle: 'Bash', icon: 'terminal' },
  Edit: { titleKey: 'chat.tools.editTool', fallbackTitle: 'Edit File', icon: 'edit' },
  EnterPlanMode: { titleKey: 'chat.tools.enterPlanMode', fallbackTitle: 'Enter Plan Mode', icon: 'rule_settings' },
  ExitPlanMode: { titleKey: 'chat.tools.exitPlanMode', fallbackTitle: 'Exit Plan Mode', icon: 'exit_to_app' },
  Glob: { titleKey: 'chat.tools.globTool', fallbackTitle: 'Glob', icon: 'search' },
  Grep: { titleKey: 'chat.tools.grepTool', fallbackTitle: 'Grep', icon: 'find_in_page' },
  LS: { titleKey: 'chat.tools.lsTool', fallbackTitle: 'List Directory', icon: 'folder_open' },
  NotebookEdit: { titleKey: 'chat.tools.notebookEdit', fallbackTitle: 'Notebook Edit', icon: 'edit_note' },
  Read: { titleKey: 'chat.tools.read', fallbackTitle: 'Read File', icon: 'visibility' },
  Skill: { titleKey: 'chat.tools.skill', fallbackTitle: 'Skill', icon: 'auto_awesome' },
  Task: { titleKey: 'chat.tools.claudeTask', fallbackTitle: 'Claude Task', icon: 'smart_toy' },
  TaskCreate: { titleKey: 'chat.tools.taskCreate', fallbackTitle: 'Create Task', icon: 'add_task' },
  TaskGet: { titleKey: 'chat.tools.taskGet', fallbackTitle: 'Get Task', icon: 'info' },
  TaskList: { titleKey: 'chat.tools.taskList', fallbackTitle: 'List Tasks', icon: 'list_alt' },
  TaskUpdate: { titleKey: 'chat.tools.taskUpdate', fallbackTitle: 'Update Task', icon: 'edit_calendar' },
  TodoWrite: { titleKey: 'chat.tools.todo', fallbackTitle: 'Task Planning', icon: 'task_alt' },
  WebFetch: { titleKey: 'chat.tools.webFetch', fallbackTitle: 'Web Fetch', icon: 'language' },
  WebSearch: { titleKey: 'chat.tools.webSearch', fallbackTitle: 'Web Search', icon: 'travel_explore' },
  Write: { titleKey: 'chat.tools.write', fallbackTitle: 'Write File', icon: 'edit_note' }
}

export const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

export const asString = (value: unknown) => (
  typeof value === 'string' && value.trim() !== '' ? value : undefined
)

export const asNumber = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
)

export const asBoolean = (value: unknown) => (
  typeof value === 'boolean' ? value : undefined
)

export const asStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const items = value
    .filter(item => typeof item === 'string' && item.trim() !== '')
    .map(item => item.trim())
  return items.length > 0 ? items : undefined
}

export const pushField = (
  fields: ClaudeToolField[],
  usedKeys: Set<string>,
  key: string,
  field: Omit<ClaudeToolField, 'value'> & { value: unknown }
) => {
  const { value } = field
  if (value == null || value === '') {
    return
  }
  if (Array.isArray(value) && value.length === 0) {
    return
  }
  if (isRecord(value) && Object.keys(value).length === 0) {
    return
  }

  usedKeys.add(key)
  fields.push(field)
}

export const toQuestionList = (value: unknown): ClaudeToolQuestion[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const questions: ClaudeToolQuestion[] = []
  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }

    const question = asString(item.question)
    if (question == null) {
      continue
    }

    const options: ClaudeToolQuestionOption[] = []
    if (Array.isArray(item.options)) {
      for (const option of item.options) {
        if (!isRecord(option)) {
          continue
        }

        const label = asString(option.label)
        if (label == null) {
          continue
        }

        options.push({
          label,
          description: asString(option.description)
        })
      }
    }

    questions.push({
      header: asString(item.header),
      question,
      options,
      multiSelect: item.multiSelect === true
    })
  }

  return questions.length > 0 ? questions : undefined
}

export const getDescriptionTitle = (value: string | undefined) => (
  value != null && value !== '' ? value.split('\n')[0]?.trim() || value : undefined
)

export const addDetailsField = (
  fields: ClaudeToolField[],
  record: Record<string, unknown> | null,
  usedKeys: Set<string>
) => {
  if (record == null) {
    return
  }

  const details = Object.fromEntries(
    Object.entries(record).filter(([key, value]) => {
      if (usedKeys.has(key) || value == null) {
        return false
      }
      if (typeof value === 'string') {
        return value.trim() !== ''
      }
      if (Array.isArray(value)) {
        return value.length > 0
      }
      return !isRecord(value) || Object.keys(value).length > 0
    })
  )

  if (Object.keys(details).length > 0) {
    fields.push({
      labelKey: 'chat.tools.fields.details',
      fallbackLabel: 'Details',
      format: 'json',
      value: details
    })
  }
}
