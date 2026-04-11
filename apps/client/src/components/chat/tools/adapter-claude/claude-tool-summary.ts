import { buildClaudeToolPresentation, getClaudeToolBaseName } from './claude-tool-presentation'
import { isRecord, toQuestionList } from './claude-tool-shared'
import { getFileInfo } from './utils'

type Translate = (key: string, options?: Record<string, unknown>) => string

const getRecord = (input: unknown) => (isRecord(input) ? input : null)

const joinSummary = (title: string, primary?: string) => (
  primary != null && primary !== '' ? `${title} ${primary}` : title
)

export function getClaudeToolSummaryText(name: string, input: unknown, t: Translate) {
  const baseName = getClaudeToolBaseName(name)
  const record = getRecord(input)

  if (baseName === 'Bash') {
    const description = [record?.description, record?.reason, record?.thought]
      .find(value => typeof value === 'string' && value.trim() !== '')
    const command = typeof record?.command === 'string' ? record.command : ''
    const commandLine = command.split('\n')[0]?.trim()
    return typeof description === 'string' && description.trim() !== ''
      ? description.trim()
      : joinSummary(t('chat.tools.bash', { defaultValue: 'Bash' }), commandLine)
  }

  if (baseName === 'Read' || baseName === 'Write' || baseName === 'Edit') {
    const pathValue = typeof record?.file_path === 'string' ? getFileInfo(record.file_path).filePath : undefined
    const titleKey = baseName === 'Read'
      ? 'chat.tools.read'
      : baseName === 'Write'
      ? 'chat.tools.write'
      : 'chat.tools.editTool'
    const fallback = baseName === 'Read' ? 'Read File' : baseName === 'Write' ? 'Write File' : 'Edit File'
    return joinSummary(t(titleKey, { defaultValue: fallback }), pathValue)
  }

  if (baseName === 'NotebookEdit') {
    const notebookPath = typeof record?.notebook_path === 'string'
      ? getFileInfo(record.notebook_path).filePath
      : undefined
    return joinSummary(t('chat.tools.notebookEdit', { defaultValue: 'Notebook Edit' }), notebookPath)
  }

  if (baseName === 'LS') {
    const pathValue = typeof record?.path === 'string' && record.path !== '' ? record.path : 'current directory'
    return joinSummary(t('chat.tools.lsTool', { defaultValue: 'List Directory' }), pathValue)
  }

  if (baseName === 'Glob') {
    const pattern = typeof record?.pattern === 'string' && record.pattern !== '' ? record.pattern : '*'
    return joinSummary(t('chat.tools.globTool', { defaultValue: 'Glob' }), pattern)
  }

  if (baseName === 'Grep') {
    const pattern = typeof record?.pattern === 'string' ? record.pattern : undefined
    return joinSummary(t('chat.tools.grepTool', { defaultValue: 'Grep' }), pattern)
  }

  if (baseName === 'TodoWrite') {
    const count = Array.isArray(record?.todos) ? record.todos.length : 0
    return joinSummary(t('chat.tools.todo', { defaultValue: 'Task Planning' }), count > 0 ? `${count}` : undefined)
  }

  if (baseName === 'AskUserQuestion') {
    const firstQuestion = toQuestionList(record?.questions)?.[0]
    return joinSummary(
      t('chat.tools.askUserQuestion', { defaultValue: 'Ask User Question' }),
      firstQuestion?.header ?? firstQuestion?.question
    )
  }

  const presentation = buildClaudeToolPresentation(name, input)
  const title = t(presentation.titleKey, { defaultValue: presentation.fallbackTitle })
  return joinSummary(title, presentation.primary)
}
