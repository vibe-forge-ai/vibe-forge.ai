import { asBoolean, asNumber, asString, asStringArray, pushField } from './claude-tool-shared'
import type { ClaudeToolField } from './claude-tool-shared'
import { getFileInfo, getLanguageFromPath } from './utils'

interface BuilderParams {
  baseName: string
  record: Record<string, unknown> | null
  fields: ClaudeToolField[]
  usedKeys: Set<string>
}

export function buildClaudeOperationToolPresentation(params: BuilderParams) {
  const { baseName, record, fields, usedKeys } = params

  if (baseName === 'Bash') {
    const command = asString(record?.command)
    const description = asString(record?.description) ?? asString(record?.reason) ?? asString(record?.thought)

    pushField(fields, usedKeys, 'description', {
      labelKey: 'chat.tools.fields.description',
      fallbackLabel: 'Description',
      format: 'text',
      value: description
    })
    pushField(fields, usedKeys, 'command', {
      labelKey: 'chat.tools.fields.command',
      fallbackLabel: 'Command',
      format: 'code',
      value: command,
      lang: 'bash'
    })
    pushField(fields, usedKeys, 'timeout', {
      labelKey: 'chat.tools.fields.timeout',
      fallbackLabel: 'Timeout',
      format: 'inline',
      value: asNumber(record?.timeout)
    })
    pushField(fields, usedKeys, 'run_in_background', {
      labelKey: 'chat.tools.fields.runInBackground',
      fallbackLabel: 'Run In Background',
      format: 'inline',
      value: asBoolean(record?.run_in_background) != null ? String(record?.run_in_background) : undefined
    })
    pushField(fields, usedKeys, 'dangerouslyDisableSandbox', {
      labelKey: 'chat.tools.fields.disableSandbox',
      fallbackLabel: 'Disable Sandbox',
      format: 'inline',
      value: asBoolean(record?.dangerouslyDisableSandbox) != null
        ? String(record?.dangerouslyDisableSandbox)
        : undefined
    })
    return { handled: true, primary: description ?? command?.split('\n')[0] }
  }

  if (baseName === 'Read') {
    const filePath = asString(record?.file_path)
    const primary = filePath != null ? getFileInfo(filePath).filePath : undefined

    pushField(fields, usedKeys, 'offset', {
      labelKey: 'chat.tools.fields.offset',
      fallbackLabel: 'Offset',
      format: 'inline',
      value: asNumber(record?.offset)
    })
    pushField(fields, usedKeys, 'limit', {
      labelKey: 'chat.tools.fields.limit',
      fallbackLabel: 'Limit',
      format: 'inline',
      value: asNumber(record?.limit)
    })
    usedKeys.add('file_path')
    return { handled: true, primary }
  }

  if (baseName === 'Write') {
    const filePath = asString(record?.file_path)
    const primary = filePath != null ? getFileInfo(filePath).filePath : undefined
    const language = getLanguageFromPath(primary ?? '')

    pushField(fields, usedKeys, 'content', {
      labelKey: 'chat.tools.fields.content',
      fallbackLabel: 'Content',
      format: 'code',
      value: asString(record?.content),
      lang: language
    })
    usedKeys.add('file_path')
    return { handled: true, primary }
  }

  if (baseName === 'LS') {
    pushField(fields, usedKeys, 'ignore', {
      labelKey: 'chat.tools.fields.ignore',
      fallbackLabel: 'Ignore',
      format: 'list',
      value: asStringArray(record?.ignore)
    })
    return { handled: true, primary: asString(record?.path) ?? 'current directory' }
  }

  if (baseName === 'Glob') {
    pushField(fields, usedKeys, 'path', {
      labelKey: 'chat.tools.fields.path',
      fallbackLabel: 'Path',
      format: 'text',
      value: asString(record?.path)
    })
    usedKeys.add('pattern')
    return { handled: true, primary: asString(record?.pattern) ?? '*' }
  }

  if (baseName === 'Grep') {
    pushField(fields, usedKeys, 'path', {
      labelKey: 'chat.tools.fields.path',
      fallbackLabel: 'Path',
      format: 'text',
      value: asString(record?.path)
    })
    pushField(fields, usedKeys, 'glob', {
      labelKey: 'chat.tools.fields.glob',
      fallbackLabel: 'Glob',
      format: 'text',
      value: asString(record?.glob)
    })
    pushField(fields, usedKeys, 'output_mode', {
      labelKey: 'chat.tools.fields.mode',
      fallbackLabel: 'Mode',
      format: 'inline',
      value: asString(record?.output_mode)
    })
    usedKeys.add('pattern')
    return { handled: true, primary: asString(record?.pattern) }
  }
  return { handled: false }
}
