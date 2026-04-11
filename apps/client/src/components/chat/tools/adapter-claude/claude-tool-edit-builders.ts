import { asBoolean, asString, pushField } from './claude-tool-shared'
import type { ClaudeToolField } from './claude-tool-shared'
import { getFileInfo, getLanguageFromPath } from './utils'

interface BuilderParams {
  baseName: string
  record: Record<string, unknown> | null
  fields: ClaudeToolField[]
  usedKeys: Set<string>
}

export function buildClaudeEditToolPresentation(params: BuilderParams) {
  const { baseName, record, fields, usedKeys } = params

  if (baseName === 'TodoWrite') {
    const todos = Array.isArray(record?.todos)
      ? record.todos.flatMap((todo) => {
        if (todo == null || typeof todo !== 'object') {
          return []
        }
        const data = todo as Record<string, unknown>
        const content = asString(data.content)
        const status = asString(data.status)
        return content != null ? [`[${status ?? 'pending'}] ${content}`] : []
      })
      : undefined

    pushField(fields, usedKeys, 'todos', {
      labelKey: 'chat.tools.fields.todos',
      fallbackLabel: 'Todos',
      format: 'list',
      value: todos
    })
    return { handled: true, primary: todos != null ? `${todos.length} todos` : undefined }
  }

  if (baseName === 'Edit') {
    const filePath = asString(record?.file_path)
    const primary = filePath != null ? getFileInfo(filePath).filePath : undefined
    const language = getLanguageFromPath(primary ?? '')
    const replaceAll = asBoolean(record?.replace_all)

    pushField(fields, usedKeys, 'replace_all', {
      labelKey: 'chat.tools.fields.replaceAll',
      fallbackLabel: 'Replace All',
      format: 'inline',
      value: replaceAll != null ? String(replaceAll) : undefined
    })
    pushField(fields, usedKeys, 'old_string', {
      labelKey: 'chat.tools.fields.oldString',
      fallbackLabel: 'Old String',
      format: 'code',
      value: asString(record?.old_string),
      lang: language
    })
    pushField(fields, usedKeys, 'new_string', {
      labelKey: 'chat.tools.fields.newString',
      fallbackLabel: 'New String',
      format: 'code',
      value: asString(record?.new_string),
      lang: language
    })
    usedKeys.add('file_path')
    return { handled: true, primary }
  }

  if (baseName !== 'NotebookEdit') {
    return { handled: false }
  }

  const notebookPath = asString(record?.notebook_path)
  const primary = notebookPath != null ? getFileInfo(notebookPath).filePath : undefined
  const cellType = asString(record?.cell_type)

  pushField(fields, usedKeys, 'cell_id', {
    labelKey: 'chat.tools.fields.cellId',
    fallbackLabel: 'Cell ID',
    format: 'inline',
    value: asString(record?.cell_id)
  })
  pushField(fields, usedKeys, 'cell_type', {
    labelKey: 'chat.tools.fields.cellType',
    fallbackLabel: 'Cell Type',
    format: 'inline',
    value: cellType
  })
  pushField(fields, usedKeys, 'edit_mode', {
    labelKey: 'chat.tools.fields.editMode',
    fallbackLabel: 'Edit Mode',
    format: 'inline',
    value: asString(record?.edit_mode)
  })
  pushField(fields, usedKeys, 'new_source', {
    labelKey: 'chat.tools.fields.newSource',
    fallbackLabel: 'New Source',
    format: 'code',
    value: asString(record?.new_source),
    lang: cellType === 'markdown' ? 'markdown' : 'text'
  })
  usedKeys.add('notebook_path')
  return { handled: true, primary }
}
