export type FieldValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string[]'
  | 'select'
  | 'json'
  | 'multiline'
  | 'record'
  | 'shortcut'

export type RecordKind = 'json' | 'modelServices' | 'mcpServers' | 'boolean' | 'keyValue'

export interface FieldOption {
  value: string
  label: string
}

export interface FieldSpec {
  path: string[]
  type: FieldValueType
  defaultValue: unknown
  icon?: string
  options?: FieldOption[]
  placeholderKey?: string
  labelKey?: string
  descriptionKey?: string
  group?: 'base' | 'permissions' | 'env' | 'items'
  recordKind?: RecordKind
  sensitive?: boolean
  hidden?: boolean
  collapse?: {
    key: string
    labelKey: string
    descKey?: string
    togglePath?: string[]
  }
}

export const configGroupMeta: Record<string, Record<string, { labelKey: string }>> = {
  general: {
    items: {
      labelKey: 'config.fields.general.notifications.label'
    }
  }
}

export const configSchema: Record<string, FieldSpec[]> = {
  general: [
    { path: ['baseDir'], type: 'string', defaultValue: '.ai', icon: 'folder', group: 'base' },
    { path: ['defaultAdapter'], type: 'select', defaultValue: '', icon: 'settings_input_component', group: 'base' },
    { path: ['defaultModelService'], type: 'select', defaultValue: '', icon: 'hub', group: 'base' },
    { path: ['defaultModel'], type: 'select', defaultValue: '', icon: 'model_training', group: 'base' },
    {
      path: ['interfaceLanguage'],
      type: 'select',
      defaultValue: '',
      icon: 'language',
      group: 'base',
      options: [
        { value: 'zh', label: 'config.options.language.zh' },
        { value: 'en', label: 'config.options.language.en' }
      ]
    },
    {
      path: ['modelLanguage'],
      type: 'select',
      defaultValue: '',
      icon: 'translate',
      group: 'base',
      options: [
        { value: 'zh', label: 'config.options.language.zh' },
        { value: 'en', label: 'config.options.language.en' }
      ]
    },
    { path: ['announcements'], type: 'string[]', defaultValue: [], icon: 'campaign', group: 'base' },
    { path: ['permissions', 'allow'], type: 'string[]', defaultValue: [], icon: 'check_circle', group: 'permissions' },
    { path: ['permissions', 'deny'], type: 'string[]', defaultValue: [], icon: 'block', group: 'permissions' },
    { path: ['permissions', 'ask'], type: 'string[]', defaultValue: [], icon: 'help', group: 'permissions' },
    { path: ['env'], type: 'record', recordKind: 'keyValue', defaultValue: {}, icon: 'terminal', group: 'env' },
    { path: ['notifications', 'disabled'], type: 'boolean', defaultValue: false, icon: 'notifications', group: 'items' },
    { path: ['notifications', 'volume'], type: 'number', defaultValue: 100, icon: 'volume_down', group: 'items' },
    {
      path: ['notifications', 'events', 'completed', 'title'],
      type: 'string',
      defaultValue: '',
      icon: 'title',
      group: 'items',
      collapse: {
        key: 'notifications.events.completed',
        labelKey: 'config.fields.general.notifications.events.completed.label',
        descKey: 'config.fields.general.notifications.events.completed.desc',
        togglePath: ['notifications', 'events', 'completed', 'disabled']
      }
    },
    {
      path: ['notifications', 'events', 'completed', 'description'],
      type: 'multiline',
      defaultValue: '',
      icon: 'notes',
      group: 'items',
      collapse: {
        key: 'notifications.events.completed',
        labelKey: 'config.fields.general.notifications.events.completed.label',
        descKey: 'config.fields.general.notifications.events.completed.desc',
        togglePath: ['notifications', 'events', 'completed', 'disabled']
      }
    },
    {
      path: ['notifications', 'events', 'completed', 'sound'],
      type: 'string',
      defaultValue: '',
      icon: 'volume_up',
      group: 'items',
      collapse: {
        key: 'notifications.events.completed',
        labelKey: 'config.fields.general.notifications.events.completed.label',
        descKey: 'config.fields.general.notifications.events.completed.desc',
        togglePath: ['notifications', 'events', 'completed', 'disabled']
      }
    },
    {
      path: ['notifications', 'events', 'failed', 'title'],
      type: 'string',
      defaultValue: '',
      icon: 'title',
      group: 'items',
      collapse: {
        key: 'notifications.events.failed',
        labelKey: 'config.fields.general.notifications.events.failed.label',
        descKey: 'config.fields.general.notifications.events.failed.desc',
        togglePath: ['notifications', 'events', 'failed', 'disabled']
      }
    },
    {
      path: ['notifications', 'events', 'failed', 'description'],
      type: 'multiline',
      defaultValue: '',
      icon: 'notes',
      group: 'items',
      collapse: {
        key: 'notifications.events.failed',
        labelKey: 'config.fields.general.notifications.events.failed.label',
        descKey: 'config.fields.general.notifications.events.failed.desc',
        togglePath: ['notifications', 'events', 'failed', 'disabled']
      }
    },
    {
      path: ['notifications', 'events', 'failed', 'sound'],
      type: 'string',
      defaultValue: '',
      icon: 'volume_up',
      group: 'items',
      collapse: {
        key: 'notifications.events.failed',
        labelKey: 'config.fields.general.notifications.events.failed.label',
        descKey: 'config.fields.general.notifications.events.failed.desc',
        togglePath: ['notifications', 'events', 'failed', 'disabled']
      }
    },
    {
      path: ['notifications', 'events', 'terminated', 'title'],
      type: 'string',
      defaultValue: '',
      icon: 'title',
      group: 'items',
      collapse: {
        key: 'notifications.events.terminated',
        labelKey: 'config.fields.general.notifications.events.terminated.label',
        descKey: 'config.fields.general.notifications.events.terminated.desc',
        togglePath: ['notifications', 'events', 'terminated', 'disabled']
      }
    },
    {
      path: ['notifications', 'events', 'terminated', 'description'],
      type: 'multiline',
      defaultValue: '',
      icon: 'notes',
      group: 'items',
      collapse: {
        key: 'notifications.events.terminated',
        labelKey: 'config.fields.general.notifications.events.terminated.label',
        descKey: 'config.fields.general.notifications.events.terminated.desc',
        togglePath: ['notifications', 'events', 'terminated', 'disabled']
      }
    },
    {
      path: ['notifications', 'events', 'terminated', 'sound'],
      type: 'string',
      defaultValue: '',
      icon: 'volume_up',
      group: 'items',
      collapse: {
        key: 'notifications.events.terminated',
        labelKey: 'config.fields.general.notifications.events.terminated.label',
        descKey: 'config.fields.general.notifications.events.terminated.desc',
        togglePath: ['notifications', 'events', 'terminated', 'disabled']
      }
    },
    {
      path: ['notifications', 'events', 'waiting_input', 'title'],
      type: 'string',
      defaultValue: '',
      icon: 'title',
      group: 'items',
      collapse: {
        key: 'notifications.events.waiting_input',
        labelKey: 'config.fields.general.notifications.events.waiting_input.label',
        descKey: 'config.fields.general.notifications.events.waiting_input.desc',
        togglePath: ['notifications', 'events', 'waiting_input', 'disabled']
      }
    },
    {
      path: ['notifications', 'events', 'waiting_input', 'description'],
      type: 'multiline',
      defaultValue: '',
      icon: 'notes',
      group: 'items',
      collapse: {
        key: 'notifications.events.waiting_input',
        labelKey: 'config.fields.general.notifications.events.waiting_input.label',
        descKey: 'config.fields.general.notifications.events.waiting_input.desc',
        togglePath: ['notifications', 'events', 'waiting_input', 'disabled']
      }
    },
    {
      path: ['notifications', 'events', 'waiting_input', 'sound'],
      type: 'string',
      defaultValue: '',
      icon: 'volume_up',
      group: 'items',
      collapse: {
        key: 'notifications.events.waiting_input',
        labelKey: 'config.fields.general.notifications.events.waiting_input.label',
        descKey: 'config.fields.general.notifications.events.waiting_input.desc',
        togglePath: ['notifications', 'events', 'waiting_input', 'disabled']
      }
    }
  ],
  conversation: [
    {
      path: ['style'],
      type: 'select',
      defaultValue: 'friendly',
      icon: 'forum',
      options: [
        { value: 'friendly', label: 'config.options.conversation.friendly' },
        { value: 'programmatic', label: 'config.options.conversation.programmatic' }
      ]
    },
    { path: ['customInstructions'], type: 'multiline', defaultValue: '', icon: 'description' }
  ],
  modelServices: [
    {
      path: [],
      type: 'record',
      recordKind: 'modelServices',
      defaultValue: {},
      icon: 'hub'
    }
  ],
  adapters: [
    {
      path: [],
      type: 'record',
      recordKind: 'json',
      defaultValue: {},
      icon: 'settings_input_component'
    }
  ],
  plugins: [
    {
      path: ['plugins'],
      type: 'record',
      recordKind: 'json',
      defaultValue: {},
      icon: 'extension'
    },
    {
      path: ['enabledPlugins'],
      type: 'record',
      recordKind: 'boolean',
      defaultValue: {},
      group: 'base',
      icon: 'toggle_on',
      labelKey: 'config.fields.plugins.enabled.label',
      descriptionKey: 'config.fields.plugins.enabled.desc'
    },
    {
      path: ['extraKnownMarketplaces'],
      type: 'record',
      recordKind: 'json',
      defaultValue: {},
      group: 'base',
      icon: 'storefront',
      labelKey: 'config.fields.plugins.marketplaces.label',
      descriptionKey: 'config.fields.plugins.marketplaces.desc'
    }
  ],
  mcp: [
    { path: ['defaultIncludeMcpServers'], type: 'string[]', defaultValue: [], group: 'base', icon: 'playlist_add' },
    { path: ['defaultExcludeMcpServers'], type: 'string[]', defaultValue: [], group: 'base', icon: 'playlist_remove' },
    { path: ['noDefaultVibeForgeMcpServer'], type: 'boolean', defaultValue: false, group: 'base', icon: 'block' },
    {
      path: ['mcpServers'],
      type: 'record',
      recordKind: 'mcpServers',
      defaultValue: {},
      icon: 'account_tree'
    }
  ],
  shortcuts: [
    { path: ['newSession'], type: 'shortcut', defaultValue: '', icon: 'add_comment' },
    { path: ['openConfig'], type: 'shortcut', defaultValue: '', icon: 'settings' },
    { path: ['sendMessage'], type: 'shortcut', defaultValue: '', icon: 'send' },
    { path: ['clearInput'], type: 'shortcut', defaultValue: '', icon: 'clear' }
  ]
}
