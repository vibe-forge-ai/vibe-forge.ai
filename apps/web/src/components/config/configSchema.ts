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
}

export const configSchema: Record<string, FieldSpec[]> = {
  general: [
    { path: ['baseDir'], type: 'string', defaultValue: '.ai', icon: 'folder', group: 'base' },
    { path: ['defaultAdapter'], type: 'select', defaultValue: '', icon: 'settings_input_component', group: 'base' },
    { path: ['defaultModelService'], type: 'select', defaultValue: '', icon: 'hub', group: 'base' },
    { path: ['defaultModel'], type: 'select', defaultValue: '', icon: 'model_training', group: 'base' },
    { path: ['announcements'], type: 'string[]', defaultValue: [], icon: 'campaign', group: 'base' },
    { path: ['permissions', 'allow'], type: 'string[]', defaultValue: [], icon: 'check_circle', group: 'permissions' },
    { path: ['permissions', 'deny'], type: 'string[]', defaultValue: [], icon: 'block', group: 'permissions' },
    { path: ['permissions', 'ask'], type: 'string[]', defaultValue: [], icon: 'help', group: 'permissions' },
    { path: ['env'], type: 'record', recordKind: 'keyValue', defaultValue: {}, icon: 'terminal', group: 'env' }
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
