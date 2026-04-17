import type { TranslationFn } from './configUtils'

export type FieldValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string[]'
  | 'select'
  | 'json'
  | 'multiline'
  | 'record'
  | 'detailCollection'
  | 'shortcut'

export type RecordKind = 'json' | 'modelServices' | 'mcpServers' | 'boolean' | 'keyValue' | 'channels'

export interface FieldOption {
  value: string
  label: string
}

export interface FieldSpec {
  path: string[]
  type: FieldValueType
  defaultValue: unknown
  shortcutKind?: 'sendMessage'
  icon?: string
  options?: FieldOption[]
  placeholderKey?: string
  labelKey?: string
  descriptionKey?: string
  group?: string
  recordKind?: RecordKind
  sensitive?: boolean
  hidden?: boolean
  collapse?: {
    key: string
    labelKey: string
    descKey?: string
    togglePath?: string[]
  }
  detailCollection?: DetailCollectionSpec
}

export interface DetailCollectionContext {
  mergedModelServices: Record<string, unknown>
  mergedAdapters: Record<string, unknown>
  t: TranslationFn
}

export interface DetailCollectionBooleanControlSpec {
  kind: 'boolean'
  path: string[]
  checkedValue?: boolean
  labelKey?: string
}

interface DetailCollectionBaseSpec {
  detailKind?: 'recommendedModels' | 'mcpServer'
  itemFields?: FieldSpec[]
  summaryControls?: DetailCollectionBooleanControlSpec[]
  getItemTitle: (
    item: Record<string, unknown>,
    itemKey: string,
    itemIndex: number,
    context: DetailCollectionContext
  ) => string
  getItemSubtitle?: (
    item: Record<string, unknown>,
    itemKey: string,
    itemIndex: number,
    context: DetailCollectionContext
  ) => string | undefined
  getItemDescription?: (
    item: Record<string, unknown>,
    itemKey: string,
    itemIndex: number,
    context: DetailCollectionContext
  ) => string | undefined
  getBreadcrumbLabel?: (
    item: Record<string, unknown>,
    itemKey: string,
    itemIndex: number,
    context: DetailCollectionContext
  ) => string
}

export interface DetailListCollectionSpec extends DetailCollectionBaseSpec {
  collectionKind: 'list'
  createItem: () => Record<string, unknown>
  keyPlaceholderKey?: never
}

export interface DetailRecordCollectionSpec extends DetailCollectionBaseSpec {
  collectionKind: 'record'
  itemKeys: string[]
  createItem?: (itemKey: string) => Record<string, unknown>
  keyPlaceholderKey?: never
}

export interface DetailRecordMapCollectionSpec extends DetailCollectionBaseSpec {
  collectionKind: 'recordMap'
  keyPlaceholderKey?: string
  createItem?: (itemKey: string, itemKind?: string) => Record<string, unknown>
}

export type DetailCollectionSpec =
  | DetailListCollectionSpec
  | DetailRecordCollectionSpec
  | DetailRecordMapCollectionSpec

export interface ConfigGroupMeta {
  labelKey: string
  collapsible?: boolean
  defaultExpanded?: boolean
}

export const configGroupMeta: Record<string, Record<string, ConfigGroupMeta>> = {
  general: {
    base: {
      labelKey: 'config.sectionGroups.base',
      collapsible: true,
      defaultExpanded: true
    },
    models: {
      labelKey: 'config.sectionGroups.models',
      collapsible: true,
      defaultExpanded: true
    },
    advanced: {
      labelKey: 'config.sectionGroups.advanced',
      collapsible: true,
      defaultExpanded: false
    },
    permissions: {
      labelKey: 'config.sectionGroups.permissions',
      collapsible: true,
      defaultExpanded: true
    },
    env: {
      labelKey: 'config.sectionGroups.env',
      collapsible: true,
      defaultExpanded: false
    },
    items: {
      labelKey: 'config.fields.general.notifications.label',
      collapsible: true,
      defaultExpanded: true
    }
  }
}

export const configGroupOrder: Record<string, string[]> = {
  general: ['base', 'models', 'permissions', 'env', 'items', 'advanced', 'default']
}

const notificationEventDetailFields: FieldSpec[] = [
  {
    path: ['title'],
    type: 'string',
    defaultValue: '',
    icon: 'title',
    labelKey: 'config.fields.general.notifications.events.item.title.label',
    descriptionKey: 'config.fields.general.notifications.events.item.title.desc'
  },
  {
    path: ['description'],
    type: 'multiline',
    defaultValue: '',
    icon: 'notes',
    labelKey: 'config.fields.general.notifications.events.item.description.label',
    descriptionKey: 'config.fields.general.notifications.events.item.description.desc'
  },
  {
    path: ['sound'],
    type: 'string',
    defaultValue: '',
    icon: 'volume_up',
    labelKey: 'config.fields.general.notifications.events.item.sound.label',
    descriptionKey: 'config.fields.general.notifications.events.item.sound.desc'
  }
]

const modelServiceDetailFields: FieldSpec[] = [
  {
    path: ['title'],
    type: 'string',
    defaultValue: '',
    icon: 'title',
    labelKey: 'config.fields.modelServices.item.title.label',
    descriptionKey: 'config.fields.modelServices.item.title.desc'
  },
  {
    path: ['description'],
    type: 'multiline',
    defaultValue: '',
    icon: 'notes',
    labelKey: 'config.fields.modelServices.item.description.label',
    descriptionKey: 'config.fields.modelServices.item.description.desc'
  },
  {
    path: ['apiBaseUrl'],
    type: 'string',
    defaultValue: '',
    icon: 'link',
    labelKey: 'config.fields.modelServices.item.apiBaseUrl.label',
    descriptionKey: 'config.fields.modelServices.item.apiBaseUrl.desc'
  },
  {
    path: ['apiKey'],
    type: 'string',
    defaultValue: '',
    icon: 'key',
    sensitive: true,
    labelKey: 'config.fields.modelServices.item.apiKey.label',
    descriptionKey: 'config.fields.modelServices.item.apiKey.desc'
  },
  {
    path: ['models'],
    type: 'string[]',
    defaultValue: [],
    icon: 'view_list',
    labelKey: 'config.fields.modelServices.item.models.label',
    descriptionKey: 'config.fields.modelServices.item.models.desc'
  },
  {
    path: ['timeoutMs'],
    type: 'number',
    defaultValue: undefined,
    icon: 'timer',
    labelKey: 'config.fields.modelServices.item.timeoutMs.label',
    descriptionKey: 'config.fields.modelServices.item.timeoutMs.desc'
  },
  {
    path: ['maxOutputTokens'],
    type: 'number',
    defaultValue: undefined,
    icon: 'numbers',
    labelKey: 'config.fields.modelServices.item.maxOutputTokens.label',
    descriptionKey: 'config.fields.modelServices.item.maxOutputTokens.desc'
  },
  {
    path: ['extra'],
    type: 'json',
    defaultValue: {},
    icon: 'account_tree',
    labelKey: 'config.fields.modelServices.item.extra.label',
    descriptionKey: 'config.fields.modelServices.item.extra.desc'
  }
]

const pluginInstanceDetailFields: FieldSpec[] = [
  {
    path: ['id'],
    type: 'string',
    defaultValue: '',
    icon: 'extension'
  },
  {
    path: ['enabled'],
    type: 'boolean',
    defaultValue: true,
    icon: 'toggle_on',
    labelKey: 'config.fields.plugins.enabled.label',
    descriptionKey: 'config.fields.plugins.enabled.desc'
  },
  {
    path: ['scope'],
    type: 'string',
    defaultValue: '',
    icon: 'label'
  },
  {
    path: ['options'],
    type: 'json',
    defaultValue: {},
    icon: 'tune'
  },
  {
    path: ['children'],
    type: 'json',
    defaultValue: [],
    icon: 'device_hub'
  }
]

const pluginMarketplaceDetailFields: FieldSpec[] = [
  {
    path: ['type'],
    type: 'string',
    defaultValue: 'claude-code',
    icon: 'category'
  },
  {
    path: ['enabled'],
    type: 'boolean',
    defaultValue: true,
    icon: 'toggle_on',
    labelKey: 'config.fields.plugins.enabled.label',
    descriptionKey: 'config.fields.plugins.enabled.desc'
  },
  {
    path: ['syncOnRun'],
    type: 'boolean',
    defaultValue: false,
    icon: 'sync'
  },
  {
    path: ['plugins'],
    type: 'json',
    defaultValue: {},
    icon: 'extension'
  },
  {
    path: ['options'],
    type: 'json',
    defaultValue: {},
    icon: 'store'
  }
]

const notificationEventKeys = ['completed', 'failed', 'terminated', 'waiting_input']
const getNotificationEventLabel = (t: TranslationFn, itemKey: string) => {
  const labelKey = `config.fields.general.notifications.events.${itemKey}.label`
  const translated = t(labelKey)
  return translated === labelKey ? itemKey : translated
}

const getNotificationEventDescription = (t: TranslationFn, itemKey: string) => {
  const descKey = `config.fields.general.notifications.events.${itemKey}.desc`
  const translated = t(descKey, { defaultValue: '' })
  return translated === descKey ? '' : translated
}

export const configSchema: Record<string, FieldSpec[]> = {
  general: [
    { path: ['baseDir'], type: 'string', defaultValue: '.ai', icon: 'folder', group: 'base' },
    {
      path: ['effort'],
      type: 'select',
      defaultValue: '',
      icon: 'psychology',
      group: 'models',
      options: [
        { value: 'low', label: 'config.options.effort.low' },
        { value: 'medium', label: 'config.options.effort.medium' },
        { value: 'high', label: 'config.options.effort.high' },
        { value: 'max', label: 'config.options.effort.max' }
      ]
    },
    {
      path: ['defaultAdapter'],
      type: 'select',
      defaultValue: '',
      icon: 'settings_input_component',
      group: 'models'
    },
    { path: ['defaultModelService'], type: 'select', defaultValue: '', icon: 'hub', group: 'models' },
    { path: ['defaultModel'], type: 'select', defaultValue: '', icon: 'model_training', group: 'models' },
    {
      path: ['recommendedModels'],
      type: 'detailCollection',
      defaultValue: [],
      icon: 'stars',
      group: 'models',
      detailCollection: {
        collectionKind: 'list',
        detailKind: 'recommendedModels',
        createItem: () => ({
          model: '',
          placement: 'modelSelector'
        }),
        getItemTitle: (item, _itemKey, itemIndex, { t }) => {
          const title = typeof item.title === 'string' ? item.title.trim() : ''
          if (title !== '') return title
          const model = typeof item.model === 'string' ? item.model.trim() : ''
          if (model !== '') return model
          return `${t('config.fields.general.recommendedModels.label')} #${itemIndex + 1}`
        },
        getItemSubtitle: (item, _itemKey, _itemIndex, { t }) => {
          const parts: string[] = []
          const service = typeof item.service === 'string' ? item.service.trim() : ''
          const model = typeof item.model === 'string' ? item.model.trim() : ''
          const placement = typeof item.placement === 'string'
            ? t(`config.options.recommendedModels.${item.placement}`, { defaultValue: item.placement })
            : ''
          if (service !== '') parts.push(service)
          if (model !== '') parts.push(model)
          if (placement !== '') parts.push(placement)
          return parts.length > 0 ? parts.join(' · ') : undefined
        },
        getItemDescription: (item) => {
          const description = typeof item.description === 'string' ? item.description.trim() : ''
          return description !== '' ? description : undefined
        },
        getBreadcrumbLabel: (item, _itemKey, itemIndex, context) => (
          typeof item.title === 'string' && item.title.trim() !== ''
            ? item.title.trim()
            : typeof item.model === 'string' && item.model.trim() !== ''
            ? item.model.trim()
            : `${context.t('config.fields.general.recommendedModels.label')} #${itemIndex + 1}`
        )
      }
    },
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
    { path: ['announcements'], type: 'string[]', defaultValue: [], icon: 'campaign', group: 'advanced' },
    { path: ['permissions', 'allow'], type: 'string[]', defaultValue: [], icon: 'check_circle', group: 'permissions' },
    { path: ['permissions', 'deny'], type: 'string[]', defaultValue: [], icon: 'block', group: 'permissions' },
    { path: ['permissions', 'ask'], type: 'string[]', defaultValue: [], icon: 'help', group: 'permissions' },
    { path: ['env'], type: 'record', recordKind: 'keyValue', defaultValue: {}, icon: 'terminal', group: 'env' },
    {
      path: ['notifications', 'disabled'],
      type: 'boolean',
      defaultValue: false,
      icon: 'notifications',
      group: 'items'
    },
    { path: ['notifications', 'volume'], type: 'number', defaultValue: 100, icon: 'volume_down', group: 'items' },
    {
      path: ['notifications', 'events'],
      type: 'detailCollection',
      defaultValue: {},
      icon: 'notifications_active',
      group: 'items',
      labelKey: 'config.fields.general.notifications.events.label',
      descriptionKey: 'config.fields.general.notifications.events.desc',
      detailCollection: {
        collectionKind: 'record',
        itemKeys: [...notificationEventKeys],
        createItem: () => ({}),
        itemFields: notificationEventDetailFields,
        summaryControls: [
          {
            kind: 'boolean',
            path: ['disabled'],
            checkedValue: false,
            labelKey: 'config.fields.general.notifications.events.item.enabled.label'
          }
        ],
        getItemTitle: (_item, itemKey, _itemIndex, { t }) => getNotificationEventLabel(t, itemKey),
        getItemSubtitle: (item) => {
          const parts: string[] = []
          const title = typeof item.title === 'string' ? item.title.trim() : ''
          const sound = typeof item.sound === 'string' ? item.sound.trim() : ''
          if (title !== '') parts.push(title)
          if (sound !== '') parts.push(sound)
          return parts.length > 0 ? parts.join(' · ') : undefined
        },
        getItemDescription: (_item, itemKey, _itemIndex, { t }) => getNotificationEventDescription(t, itemKey),
        getBreadcrumbLabel: (_item, itemKey, _itemIndex, { t }) => getNotificationEventLabel(t, itemKey)
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
    { path: ['createSessionWorktree'], type: 'boolean', defaultValue: true, icon: 'account_tree' },
    { path: ['customInstructions'], type: 'multiline', defaultValue: '', icon: 'description' }
  ],
  models: [
    {
      path: [],
      type: 'record',
      recordKind: 'json',
      defaultValue: {},
      icon: 'tune'
    }
  ],
  modelServices: [
    {
      path: [],
      type: 'detailCollection',
      defaultValue: {},
      icon: 'hub',
      labelKey: 'config.fields.modelServices.items.label',
      descriptionKey: 'config.fields.modelServices.items.desc',
      detailCollection: {
        collectionKind: 'recordMap',
        keyPlaceholderKey: 'config.editor.newModelServiceName',
        createItem: () => ({
          title: '',
          description: '',
          apiBaseUrl: '',
          apiKey: '',
          models: [],
          timeoutMs: undefined,
          maxOutputTokens: undefined,
          extra: {}
        }),
        itemFields: modelServiceDetailFields,
        getItemTitle: (item, itemKey) => {
          const title = typeof item.title === 'string' ? item.title.trim() : ''
          return title !== '' ? title : itemKey
        },
        getItemSubtitle: (item, itemKey) => {
          const title = typeof item.title === 'string' ? item.title.trim() : ''
          return title !== '' ? itemKey : undefined
        },
        getItemDescription: (item) => {
          const description = typeof item.description === 'string' ? item.description.trim() : ''
          return description !== '' ? description : undefined
        },
        getBreadcrumbLabel: (item, itemKey) => {
          const title = typeof item.title === 'string' ? item.title.trim() : ''
          return title !== '' ? title : itemKey
        }
      }
    }
  ],
  channels: [
    {
      path: [],
      type: 'detailCollection',
      defaultValue: {},
      icon: 'campaign',
      labelKey: 'config.sections.channels',
      detailCollection: {
        collectionKind: 'recordMap',
        keyPlaceholderKey: 'config.editor.newChannelName',
        getItemTitle: (_item, itemKey) => itemKey,
        getItemSubtitle: (item, _itemKey, _itemIndex, { t }) => {
          const type = typeof item.type === 'string' ? item.type : ''
          if (type === '') return undefined
          const translated = t(`config.options.channels.${type}`, { defaultValue: type })
          return translated
        },
        getItemDescription: (item) => {
          const description = typeof item.description === 'string' ? item.description.trim() : ''
          return description !== '' ? description : undefined
        },
        getBreadcrumbLabel: (_item, itemKey) => itemKey
      }
    }
  ],
  adapters: [
    {
      path: [],
      type: 'detailCollection',
      defaultValue: {},
      icon: 'settings_input_component',
      labelKey: 'config.sections.adapters',
      detailCollection: {
        collectionKind: 'recordMap',
        keyPlaceholderKey: 'config.editor.newAdapterName',
        getItemTitle: (_item, itemKey) => itemKey,
        getBreadcrumbLabel: (_item, itemKey) => itemKey
      }
    }
  ],
  plugins: [
    {
      path: ['plugins'],
      type: 'detailCollection',
      defaultValue: [],
      icon: 'extension',
      labelKey: 'config.fields.plugins.items.label',
      descriptionKey: 'config.fields.plugins.items.desc',
      detailCollection: {
        collectionKind: 'list',
        createItem: () => ({
          id: '',
          enabled: true,
          scope: '',
          options: {},
          children: []
        }),
        itemFields: pluginInstanceDetailFields,
        summaryControls: [{ kind: 'boolean', path: ['enabled'], checkedValue: true }],
        getItemTitle: (item, _itemKey, itemIndex) => {
          const id = typeof item.id === 'string' ? item.id.trim() : ''
          return id !== '' ? id : `Plugin #${itemIndex + 1}`
        },
        getItemSubtitle: (item) => {
          const scope = typeof item.scope === 'string' ? item.scope.trim() : ''
          return scope !== '' ? scope : undefined
        },
        getBreadcrumbLabel: (item, _itemKey, itemIndex) => {
          const id = typeof item.id === 'string' ? item.id.trim() : ''
          return id !== '' ? id : `Plugin #${itemIndex + 1}`
        }
      }
    },
    {
      path: ['marketplaces'],
      type: 'detailCollection',
      defaultValue: {},
      icon: 'store',
      labelKey: 'config.fields.plugins.marketplaces.label',
      descriptionKey: 'config.fields.plugins.marketplaces.desc',
      detailCollection: {
        collectionKind: 'recordMap',
        keyPlaceholderKey: 'config.editor.newMarketplaceName',
        createItem: () => ({
          type: 'claude-code',
          enabled: true,
          syncOnRun: false,
          plugins: {},
          options: {}
        }),
        itemFields: pluginMarketplaceDetailFields,
        summaryControls: [{ kind: 'boolean', path: ['enabled'], checkedValue: true }],
        getItemTitle: (_item, itemKey) => itemKey,
        getItemSubtitle: (item) => {
          const type = typeof item.type === 'string' ? item.type.trim() : ''
          return type !== '' ? type : undefined
        },
        getBreadcrumbLabel: (_item, itemKey) => itemKey
      }
    }
  ],
  mcp: [
    { path: ['defaultIncludeMcpServers'], type: 'string[]', defaultValue: [], group: 'base', icon: 'playlist_add' },
    { path: ['defaultExcludeMcpServers'], type: 'string[]', defaultValue: [], group: 'base', icon: 'playlist_remove' },
    { path: ['noDefaultVibeForgeMcpServer'], type: 'boolean', defaultValue: false, group: 'base', icon: 'block' },
    {
      path: ['mcpServers'],
      type: 'detailCollection',
      defaultValue: {},
      icon: 'account_tree',
      labelKey: 'config.fields.mcp.mcpServers.label',
      descriptionKey: 'config.fields.mcp.mcpServers.desc',
      detailCollection: {
        collectionKind: 'recordMap',
        detailKind: 'mcpServer',
        keyPlaceholderKey: 'config.editor.newMcpServerName',
        createItem: () => ({
          enabled: true,
          command: '',
          args: []
        }),
        summaryControls: [{ kind: 'boolean', path: ['enabled'], checkedValue: true }],
        getItemTitle: (_item, itemKey) => itemKey,
        getItemSubtitle: (item, _itemKey, _itemIndex, { t }) => {
          const type = typeof item.type === 'string' && item.type.trim() !== ''
            ? item.type.trim()
            : 'command'
          return t(`config.options.mcp.${type}`, { defaultValue: type })
        },
        getBreadcrumbLabel: (_item, itemKey) => itemKey
      }
    }
  ],
  shortcuts: [
    { path: ['newSession'], type: 'shortcut', defaultValue: '', icon: 'add_comment' },
    { path: ['openConfig'], type: 'shortcut', defaultValue: '', icon: 'settings' },
    { path: ['sendMessage'], type: 'shortcut', shortcutKind: 'sendMessage', defaultValue: '', icon: 'send' },
    { path: ['clearInput'], type: 'shortcut', defaultValue: '', icon: 'clear' },
    { path: ['switchModel'], type: 'shortcut', defaultValue: '', icon: 'model_training' },
    { path: ['switchEffort'], type: 'shortcut', defaultValue: '', icon: 'psychology' },
    { path: ['switchPermissionMode'], type: 'shortcut', defaultValue: '', icon: 'lock' }
  ]
}
