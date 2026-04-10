import {
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  getDescriptionTitle,
  pushField
} from './claude-tool-shared'
import type { ClaudeToolField } from './claude-tool-shared'

interface BuilderParams {
  baseName: string
  record: Record<string, unknown> | null
  fields: ClaudeToolField[]
  usedKeys: Set<string>
}

export function buildClaudeTaskToolPresentation(params: BuilderParams) {
  const { baseName, record, fields, usedKeys } = params

  if (baseName === 'Task') {
    const description = asString(record?.description)

    pushField(fields, usedKeys, 'description', {
      labelKey: 'chat.tools.fields.description',
      fallbackLabel: 'Description',
      format: 'text',
      value: description
    })
    pushField(fields, usedKeys, 'prompt', {
      labelKey: 'chat.tools.fields.prompt',
      fallbackLabel: 'Prompt',
      format: 'text',
      value: asString(record?.prompt)
    })
    pushField(fields, usedKeys, 'subagent_type', {
      labelKey: 'chat.tools.fields.subagentType',
      fallbackLabel: 'Subagent Type',
      format: 'inline',
      value: asString(record?.subagent_type)
    })
    pushField(fields, usedKeys, 'model', {
      labelKey: 'chat.tools.fields.model',
      fallbackLabel: 'Model',
      format: 'inline',
      value: asString(record?.model)
    })
    pushField(fields, usedKeys, 'resume', {
      labelKey: 'chat.tools.fields.resume',
      fallbackLabel: 'Resume',
      format: 'inline',
      value: asString(record?.resume)
    })
    pushField(fields, usedKeys, 'run_in_background', {
      labelKey: 'chat.tools.fields.runInBackground',
      fallbackLabel: 'Run In Background',
      format: 'inline',
      value: asBoolean(record?.run_in_background) != null ? String(record?.run_in_background) : undefined
    })
    pushField(fields, usedKeys, 'max_turns', {
      labelKey: 'chat.tools.fields.maxTurns',
      fallbackLabel: 'Max Turns',
      format: 'inline',
      value: asNumber(record?.max_turns)
    })
    return { handled: true, primary: getDescriptionTitle(description) ?? asString(record?.subagent_type) }
  }

  if (baseName === 'TaskCreate') {
    pushField(fields, usedKeys, 'description', {
      labelKey: 'chat.tools.fields.description',
      fallbackLabel: 'Description',
      format: 'text',
      value: asString(record?.description)
    })
    pushField(fields, usedKeys, 'activeForm', {
      labelKey: 'chat.tools.fields.activeForm',
      fallbackLabel: 'Active Form',
      format: 'text',
      value: asString(record?.activeForm)
    })
    pushField(fields, usedKeys, 'metadata', {
      labelKey: 'chat.tools.fields.metadata',
      fallbackLabel: 'Metadata',
      format: 'json',
      value: record?.metadata != null && typeof record.metadata === 'object' ? record.metadata : undefined
    })
    usedKeys.add('subject')
    return { handled: true, primary: asString(record?.subject) }
  }

  if (baseName === 'TaskGet') {
    usedKeys.add('taskId')
    return { handled: true, primary: asString(record?.taskId) }
  }

  if (baseName === 'TaskUpdate') {
    pushField(fields, usedKeys, 'subject', {
      labelKey: 'chat.tools.fields.subject',
      fallbackLabel: 'Subject',
      format: 'text',
      value: asString(record?.subject)
    })
    pushField(fields, usedKeys, 'description', {
      labelKey: 'chat.tools.fields.description',
      fallbackLabel: 'Description',
      format: 'text',
      value: asString(record?.description)
    })
    pushField(fields, usedKeys, 'activeForm', {
      labelKey: 'chat.tools.fields.activeForm',
      fallbackLabel: 'Active Form',
      format: 'text',
      value: asString(record?.activeForm)
    })
    pushField(fields, usedKeys, 'status', {
      labelKey: 'chat.tools.fields.status',
      fallbackLabel: 'Status',
      format: 'inline',
      value: asString(record?.status)
    })
    pushField(fields, usedKeys, 'owner', {
      labelKey: 'chat.tools.fields.owner',
      fallbackLabel: 'Owner',
      format: 'inline',
      value: asString(record?.owner)
    })
    pushField(fields, usedKeys, 'addBlocks', {
      labelKey: 'chat.tools.fields.addBlocks',
      fallbackLabel: 'Add Blocks',
      format: 'list',
      value: asStringArray(record?.addBlocks)
    })
    pushField(fields, usedKeys, 'addBlockedBy', {
      labelKey: 'chat.tools.fields.addBlockedBy',
      fallbackLabel: 'Add Blocked By',
      format: 'list',
      value: asStringArray(record?.addBlockedBy)
    })
    pushField(fields, usedKeys, 'metadata', {
      labelKey: 'chat.tools.fields.metadata',
      fallbackLabel: 'Metadata',
      format: 'json',
      value: record?.metadata != null && typeof record.metadata === 'object' ? record.metadata : undefined
    })
    usedKeys.add('taskId')
    return { handled: true, primary: asString(record?.taskId) }
  }

  if (baseName === 'TaskList') {
    return { handled: true }
  }

  return { handled: false }
}
