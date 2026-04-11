import { asBoolean, asString, asStringArray, pushField, toQuestionList } from './claude-tool-shared'
import type { ClaudeToolField } from './claude-tool-shared'

interface BuilderParams {
  baseName: string
  record: Record<string, unknown> | null
  fields: ClaudeToolField[]
  usedKeys: Set<string>
}

export function buildClaudeSystemToolPresentation(params: BuilderParams) {
  const { baseName, record, fields, usedKeys } = params

  if (baseName === 'WebFetch') {
    pushField(fields, usedKeys, 'prompt', {
      labelKey: 'chat.tools.fields.prompt',
      fallbackLabel: 'Prompt',
      format: 'text',
      value: asString(record?.prompt)
    })
    usedKeys.add('url')
    return { handled: true, primary: asString(record?.url) }
  }

  if (baseName === 'WebSearch') {
    pushField(fields, usedKeys, 'allowed_domains', {
      labelKey: 'chat.tools.fields.allowedDomains',
      fallbackLabel: 'Allowed Domains',
      format: 'list',
      value: asStringArray(record?.allowed_domains)
    })
    pushField(fields, usedKeys, 'blocked_domains', {
      labelKey: 'chat.tools.fields.blockedDomains',
      fallbackLabel: 'Blocked Domains',
      format: 'list',
      value: asStringArray(record?.blocked_domains)
    })
    usedKeys.add('query')
    return { handled: true, primary: asString(record?.query) }
  }

  if (baseName === 'AskUserQuestion') {
    const questions = toQuestionList(record?.questions)

    pushField(fields, usedKeys, 'questions', {
      labelKey: 'chat.tools.fields.questions',
      fallbackLabel: 'Questions',
      format: 'questions',
      value: questions
    })
    pushField(fields, usedKeys, 'answers', {
      labelKey: 'chat.tools.fields.answers',
      fallbackLabel: 'Answers',
      format: 'json',
      value: record?.answers != null && typeof record.answers === 'object' ? record.answers : undefined
    })
    pushField(fields, usedKeys, 'metadata', {
      labelKey: 'chat.tools.fields.metadata',
      fallbackLabel: 'Metadata',
      format: 'json',
      value: record?.metadata != null && typeof record.metadata === 'object' ? record.metadata : undefined
    })
    return { handled: true, primary: questions?.[0]?.header ?? questions?.[0]?.question }
  }

  if (baseName === 'Skill') {
    pushField(fields, usedKeys, 'args', {
      labelKey: 'chat.tools.fields.args',
      fallbackLabel: 'Args',
      format: 'text',
      value: asString(record?.args)
    })
    usedKeys.add('skill')
    return { handled: true, primary: asString(record?.skill) }
  }

  if (baseName === 'EnterPlanMode') {
    return { handled: true }
  }

  if (baseName !== 'ExitPlanMode') {
    return { handled: false }
  }

  pushField(fields, usedKeys, 'pushToRemote', {
    labelKey: 'chat.tools.fields.pushToRemote',
    fallbackLabel: 'Push To Remote',
    format: 'inline',
    value: asBoolean(record?.pushToRemote) != null ? String(record?.pushToRemote) : undefined
  })
  pushField(fields, usedKeys, 'remoteSessionId', {
    labelKey: 'chat.tools.fields.remoteSession',
    fallbackLabel: 'Remote Session',
    format: 'inline',
    value: asString(record?.remoteSessionId)
  })
  pushField(fields, usedKeys, 'remoteSessionUrl', {
    labelKey: 'chat.tools.fields.remoteSessionUrl',
    fallbackLabel: 'Remote Session URL',
    format: 'text',
    value: asString(record?.remoteSessionUrl)
  })
  pushField(fields, usedKeys, 'allowedPrompts', {
    labelKey: 'chat.tools.fields.allowedPrompts',
    fallbackLabel: 'Allowed Prompts',
    format: 'list',
    value: Array.isArray(record?.allowedPrompts)
      ? record.allowedPrompts.flatMap((item) => {
        if (item == null || typeof item !== 'object') {
          return []
        }
        const data = item as Record<string, unknown>
        const tool = asString(data.tool)
        const prompt = asString(data.prompt)
        return prompt != null ? [`${tool ?? 'Tool'}: ${prompt}`] : []
      })
      : undefined
  })
  usedKeys.add('remoteSessionTitle')

  return {
    handled: true,
    primary: asString(record?.remoteSessionTitle) ?? asString(record?.remoteSessionId)
  }
}
