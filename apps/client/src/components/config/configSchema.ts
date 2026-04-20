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
  getMergeKey?: (item: Record<string, unknown>) => string | undefined
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
  },
  conversation: {
    defaults: {
      labelKey: 'config.sectionGroups.base',
      collapsible: true,
      defaultExpanded: true
    },
    presets: {
      labelKey: 'config.fields.conversation.startupPresets.label',
      collapsible: true,
      defaultExpanded: true
    },
    actions: {
      labelKey: 'config.fields.conversation.builtinActions.label',
      collapsible: true,
      defaultExpanded: true
    }
  },
  mdp: {
    base: {
      labelKey: 'config.sectionGroups.base',
      collapsible: true,
      defaultExpanded: true
    },
    filters: {
      labelKey: 'config.sectionGroups.filters',
      collapsible: true,
      defaultExpanded: true
    },
    projection: {
      labelKey: 'config.sectionGroups.projection',
      collapsible: true,
      defaultExpanded: true
    },
    connections: {
      labelKey: 'config.sectionGroups.connections',
      collapsible: true,
      defaultExpanded: true
    }
  }
}

export const configGroupOrder: Record<string, string[]> = {
  general: ['base', 'models', 'permissions', 'env', 'items', 'advanced', 'default'],
  conversation: ['defaults', 'presets', 'actions', 'default'],
  mdp: ['base', 'filters', 'projection', 'connections', 'default']
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

const conversationStarterModeOptions: FieldSpec['options'] = [
  { value: 'default', label: 'config.options.conversationStarterMode.default' },
  { value: 'workspace', label: 'config.options.conversationStarterMode.workspace' },
  { value: 'agent', label: 'config.options.conversationStarterMode.agent' },
  { value: 'entity', label: 'config.options.conversationStarterMode.entity' },
  { value: 'spec', label: 'config.options.conversationStarterMode.spec' }
]

const conversationStarterEffortOptions: FieldSpec['options'] = [
  { value: 'default', label: 'config.options.effort.default' },
  { value: 'low', label: 'config.options.effort.low' },
  { value: 'medium', label: 'config.options.effort.medium' },
  { value: 'high', label: 'config.options.effort.high' },
  { value: 'max', label: 'config.options.effort.max' }
]

const conversationStarterPermissionModeOptions: FieldSpec['options'] = [
  { value: 'default', label: 'config.options.permissionMode.default' },
  { value: 'acceptEdits', label: 'config.options.permissionMode.acceptEdits' },
  { value: 'plan', label: 'config.options.permissionMode.plan' },
  { value: 'dontAsk', label: 'config.options.permissionMode.dontAsk' },
  { value: 'bypassPermissions', label: 'config.options.permissionMode.bypassPermissions' }
]

const conversationStarterBranchKindOptions: FieldSpec['options'] = [
  { value: 'local', label: 'config.options.branchKind.local' },
  { value: 'remote', label: 'config.options.branchKind.remote' }
]

const conversationStarterBranchModeOptions: FieldSpec['options'] = [
  { value: 'checkout', label: 'config.options.branchMode.checkout' },
  { value: 'create', label: 'config.options.branchMode.create' }
]

const conversationStarterDetailFields: FieldSpec[] = [
  {
    path: ['title'],
    type: 'string',
    defaultValue: '',
    icon: 'title',
    labelKey: 'config.fields.conversation.starterItem.title.label',
    descriptionKey: 'config.fields.conversation.starterItem.title.desc'
  },
  {
    path: ['description'],
    type: 'multiline',
    defaultValue: '',
    icon: 'notes',
    labelKey: 'config.fields.conversation.starterItem.description.label',
    descriptionKey: 'config.fields.conversation.starterItem.description.desc'
  },
  {
    path: ['icon'],
    type: 'string',
    defaultValue: '',
    icon: 'palette',
    labelKey: 'config.fields.conversation.starterItem.icon.label',
    descriptionKey: 'config.fields.conversation.starterItem.icon.desc'
  },
  {
    path: ['mode'],
    type: 'select',
    defaultValue: 'default',
    icon: 'category',
    options: conversationStarterModeOptions,
    labelKey: 'config.fields.conversation.starterItem.mode.label',
    descriptionKey: 'config.fields.conversation.starterItem.mode.desc'
  },
  {
    path: ['target'],
    type: 'string',
    defaultValue: '',
    icon: 'label',
    labelKey: 'config.fields.conversation.starterItem.target.label',
    descriptionKey: 'config.fields.conversation.starterItem.target.desc'
  },
  {
    path: ['targetLabel'],
    type: 'string',
    defaultValue: '',
    icon: 'title',
    labelKey: 'config.fields.conversation.starterItem.targetLabel.label',
    descriptionKey: 'config.fields.conversation.starterItem.targetLabel.desc'
  },
  {
    path: ['targetDescription'],
    type: 'multiline',
    defaultValue: '',
    icon: 'info',
    labelKey: 'config.fields.conversation.starterItem.targetDescription.label',
    descriptionKey: 'config.fields.conversation.starterItem.targetDescription.desc'
  },
  {
    path: ['model'],
    type: 'string',
    defaultValue: '',
    icon: 'model_training',
    labelKey: 'config.fields.conversation.starterItem.model.label',
    descriptionKey: 'config.fields.conversation.starterItem.model.desc'
  },
  {
    path: ['adapter'],
    type: 'string',
    defaultValue: '',
    icon: 'settings_input_component',
    labelKey: 'config.fields.conversation.starterItem.adapter.label',
    descriptionKey: 'config.fields.conversation.starterItem.adapter.desc'
  },
  {
    path: ['account'],
    type: 'string',
    defaultValue: '',
    icon: 'person',
    labelKey: 'config.fields.conversation.starterItem.account.label',
    descriptionKey: 'config.fields.conversation.starterItem.account.desc'
  },
  {
    path: ['effort'],
    type: 'select',
    defaultValue: 'default',
    icon: 'psychology',
    options: conversationStarterEffortOptions,
    labelKey: 'config.fields.conversation.starterItem.effort.label',
    descriptionKey: 'config.fields.conversation.starterItem.effort.desc'
  },
  {
    path: ['permissionMode'],
    type: 'select',
    defaultValue: 'default',
    icon: 'policy',
    options: conversationStarterPermissionModeOptions,
    labelKey: 'config.fields.conversation.starterItem.permissionMode.label',
    descriptionKey: 'config.fields.conversation.starterItem.permissionMode.desc'
  },
  {
    path: ['worktree', 'create'],
    type: 'boolean',
    defaultValue: false,
    icon: 'account_tree',
    labelKey: 'config.fields.conversation.starterItem.worktreeCreate.label',
    descriptionKey: 'config.fields.conversation.starterItem.worktreeCreate.desc'
  },
  {
    path: ['worktree', 'environment'],
    type: 'string',
    defaultValue: '',
    icon: 'deployed_code',
    labelKey: 'config.fields.conversation.starterItem.worktreeEnvironment.label',
    descriptionKey: 'config.fields.conversation.starterItem.worktreeEnvironment.desc'
  },
  {
    path: ['worktree', 'branch', 'name'],
    type: 'string',
    defaultValue: '',
    icon: 'call_split',
    labelKey: 'config.fields.conversation.starterItem.branchName.label',
    descriptionKey: 'config.fields.conversation.starterItem.branchName.desc'
  },
  {
    path: ['worktree', 'branch', 'kind'],
    type: 'select',
    defaultValue: '',
    icon: 'fork_right',
    options: conversationStarterBranchKindOptions,
    labelKey: 'config.fields.conversation.starterItem.branchKind.label',
    descriptionKey: 'config.fields.conversation.starterItem.branchKind.desc'
  },
  {
    path: ['worktree', 'branch', 'mode'],
    type: 'select',
    defaultValue: '',
    icon: 'alt_route',
    options: conversationStarterBranchModeOptions,
    labelKey: 'config.fields.conversation.starterItem.branchMode.label',
    descriptionKey: 'config.fields.conversation.starterItem.branchMode.desc'
  },
  {
    path: ['prompt'],
    type: 'multiline',
    defaultValue: '',
    icon: 'chat',
    labelKey: 'config.fields.conversation.starterItem.prompt.label',
    descriptionKey: 'config.fields.conversation.starterItem.prompt.desc'
  },
  {
    path: ['files'],
    type: 'string[]',
    defaultValue: [],
    icon: 'draft',
    labelKey: 'config.fields.conversation.starterItem.files.label',
    descriptionKey: 'config.fields.conversation.starterItem.files.desc'
  },
  {
    path: ['rules'],
    type: 'string[]',
    defaultValue: [],
    icon: 'gavel',
    labelKey: 'config.fields.conversation.starterItem.rules.label',
    descriptionKey: 'config.fields.conversation.starterItem.rules.desc'
  },
  {
    path: ['skills'],
    type: 'string[]',
    defaultValue: [],
    icon: 'school',
    labelKey: 'config.fields.conversation.starterItem.skills.label',
    descriptionKey: 'config.fields.conversation.starterItem.skills.desc'
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

const mdpConnectionDetailFields: FieldSpec[] = [
  {
    path: ['enabled'],
    type: 'boolean',
    defaultValue: true,
    icon: 'power_settings_new',
    labelKey: 'config.fields.mdp.connection.enabled.label',
    descriptionKey: 'config.fields.mdp.connection.enabled.desc'
  },
  {
    path: ['title'],
    type: 'string',
    defaultValue: '',
    icon: 'title',
    labelKey: 'config.fields.mdp.connection.title.label',
    descriptionKey: 'config.fields.mdp.connection.title.desc'
  },
  {
    path: ['description'],
    type: 'multiline',
    defaultValue: '',
    icon: 'notes',
    labelKey: 'config.fields.mdp.connection.description.label',
    descriptionKey: 'config.fields.mdp.connection.description.desc'
  },
  {
    path: ['hosts'],
    type: 'string[]',
    defaultValue: [],
    icon: 'dns',
    labelKey: 'config.fields.mdp.connection.hosts.label',
    descriptionKey: 'config.fields.mdp.connection.hosts.desc'
  },
  {
    path: ['auth'],
    type: 'json',
    defaultValue: {},
    icon: 'shield_lock',
    labelKey: 'config.fields.mdp.connection.auth.label',
    descriptionKey: 'config.fields.mdp.connection.auth.desc'
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
      group: 'defaults',
      options: [
        { value: 'friendly', label: 'config.options.conversation.friendly' },
        { value: 'programmatic', label: 'config.options.conversation.programmatic' }
      ]
    },
    { path: ['createSessionWorktree'], type: 'boolean', defaultValue: true, icon: 'account_tree', group: 'defaults' },
    { path: ['worktreeEnvironment'], type: 'select', defaultValue: '', icon: 'deployed_code', group: 'defaults' },
    { path: ['customInstructions'], type: 'multiline', defaultValue: '', icon: 'description', group: 'defaults' },
    {
      path: ['startupPresets'],
      type: 'detailCollection',
      defaultValue: [],
      icon: 'bolt',
      group: 'presets',
      labelKey: 'config.fields.conversation.startupPresets.label',
      descriptionKey: 'config.fields.conversation.startupPresets.desc',
      detailCollection: {
        collectionKind: 'list',
        createItem: () => ({
          title: 'Untitled preset',
          mode: 'default',
          prompt: '',
          files: [],
          rules: [],
          skills: []
        }),
        itemFields: conversationStarterDetailFields,
        getItemTitle: (item, _itemKey, itemIndex, { t }) => {
          const title = typeof item.title === 'string' ? item.title.trim() : ''
          if (title !== '') return title
          return `${t('config.fields.conversation.startupPresets.label')} #${itemIndex + 1}`
        },
        getItemSubtitle: (item, _itemKey, _itemIndex, { t }) => {
          const parts: string[] = []
          const mode = typeof item.mode === 'string' ? item.mode : 'default'
          const target = typeof item.target === 'string' ? item.target.trim() : ''
          const model = typeof item.model === 'string' ? item.model.trim() : ''
          const effort = typeof item.effort === 'string' ? item.effort : ''
          const worktreeCreate = item.worktree != null &&
            typeof item.worktree === 'object' &&
            !Array.isArray(item.worktree) &&
            (item.worktree as { create?: unknown }).create === true
          parts.push(t(`config.options.conversationStarterMode.${mode}`, { defaultValue: mode }))
          if (target !== '') parts.push(target)
          if (model !== '') parts.push(model)
          if (effort !== '') parts.push(t(`config.options.effort.${effort}`, { defaultValue: effort }))
          if (worktreeCreate) parts.push(t('config.fields.conversation.starterItem.worktreeEnabledBadge'))
          return parts.join(' · ')
        },
        getItemDescription: (item) => {
          const description = typeof item.description === 'string' ? item.description.trim() : ''
          return description !== '' ? description : undefined
        },
        getBreadcrumbLabel: (item, _itemKey, itemIndex, { t }) => {
          const title = typeof item.title === 'string' ? item.title.trim() : ''
          return title !== ''
            ? title
            : `${t('config.fields.conversation.startupPresets.label')} #${itemIndex + 1}`
        }
      }
    },
    {
      path: ['builtinActions'],
      type: 'detailCollection',
      defaultValue: [],
      icon: 'construction',
      group: 'actions',
      labelKey: 'config.fields.conversation.builtinActions.label',
      descriptionKey: 'config.fields.conversation.builtinActions.desc',
      detailCollection: {
        collectionKind: 'list',
        createItem: () => ({
          title: 'Untitled action',
          mode: 'default',
          prompt: '',
          files: [],
          rules: [],
          skills: []
        }),
        itemFields: conversationStarterDetailFields,
        getItemTitle: (item, _itemKey, itemIndex, { t }) => {
          const title = typeof item.title === 'string' ? item.title.trim() : ''
          if (title !== '') return title
          return `${t('config.fields.conversation.builtinActions.label')} #${itemIndex + 1}`
        },
        getItemSubtitle: (item, _itemKey, _itemIndex, { t }) => {
          const parts: string[] = []
          const mode = typeof item.mode === 'string' ? item.mode : 'default'
          const target = typeof item.target === 'string' ? item.target.trim() : ''
          const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : ''
          parts.push(t(`config.options.conversationStarterMode.${mode}`, { defaultValue: mode }))
          if (target !== '') parts.push(target)
          if (prompt !== '') parts.push(prompt.slice(0, 24))
          return parts.join(' · ')
        },
        getItemDescription: (item) => {
          const description = typeof item.description === 'string' ? item.description.trim() : ''
          return description !== '' ? description : undefined
        },
        getBreadcrumbLabel: (item, _itemKey, itemIndex, { t }) => {
          const title = typeof item.title === 'string' ? item.title.trim() : ''
          return title !== ''
            ? title
            : `${t('config.fields.conversation.builtinActions.label')} #${itemIndex + 1}`
        }
      }
    }
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
        getMergeKey: (item) => {
          const id = typeof item.id === 'string' ? item.id.trim() : ''
          if (id === '') return undefined
          const scope = typeof item.scope === 'string' ? item.scope.trim() : ''
          return `${id}::${scope}`
        },
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
  mdp: [
    {
      path: ['enabled'],
      type: 'boolean',
      defaultValue: true,
      group: 'base',
      icon: 'hub',
      labelKey: 'config.fields.mdp.enabled.label',
      descriptionKey: 'config.fields.mdp.enabled.desc'
    },
    {
      path: ['noDefaultBridge'],
      type: 'boolean',
      defaultValue: false,
      group: 'base',
      icon: 'block',
      labelKey: 'config.fields.mdp.noDefaultBridge.label',
      descriptionKey: 'config.fields.mdp.noDefaultBridge.desc'
    },
    {
      path: ['filters', 'excludeClientIds'],
      type: 'string[]',
      defaultValue: [],
      group: 'filters',
      icon: 'badge',
      labelKey: 'config.fields.mdp.filters.excludeClientIds.label',
      descriptionKey: 'config.fields.mdp.filters.excludeClientIds.desc'
    },
    {
      path: ['filters', 'excludeNames'],
      type: 'string[]',
      defaultValue: [],
      group: 'filters',
      icon: 'title',
      labelKey: 'config.fields.mdp.filters.excludeNames.label',
      descriptionKey: 'config.fields.mdp.filters.excludeNames.desc'
    },
    {
      path: ['filters', 'excludePaths'],
      type: 'string[]',
      defaultValue: [],
      group: 'filters',
      icon: 'route',
      labelKey: 'config.fields.mdp.filters.excludePaths.label',
      descriptionKey: 'config.fields.mdp.filters.excludePaths.desc'
    },
    {
      path: ['workspaceProjection', 'enabled'],
      type: 'boolean',
      defaultValue: true,
      group: 'projection',
      icon: 'account_tree',
      labelKey: 'config.fields.mdp.workspaceProjection.enabled.label',
      descriptionKey: 'config.fields.mdp.workspaceProjection.enabled.desc'
    },
    {
      path: ['workspaceProjection', 'includeWorkspaceSkills'],
      type: 'boolean',
      defaultValue: true,
      group: 'projection',
      icon: 'folder',
      labelKey: 'config.fields.mdp.workspaceProjection.includeWorkspaceSkills.label',
      descriptionKey: 'config.fields.mdp.workspaceProjection.includeWorkspaceSkills.desc'
    },
    {
      path: ['workspaceProjection', 'includePluginSkills'],
      type: 'boolean',
      defaultValue: true,
      group: 'projection',
      icon: 'extension',
      labelKey: 'config.fields.mdp.workspaceProjection.includePluginSkills.label',
      descriptionKey: 'config.fields.mdp.workspaceProjection.includePluginSkills.desc'
    },
    {
      path: ['workspaceProjection', 'includeSkillIds'],
      type: 'string[]',
      defaultValue: [],
      group: 'projection',
      icon: 'playlist_add',
      labelKey: 'config.fields.mdp.workspaceProjection.includeSkillIds.label',
      descriptionKey: 'config.fields.mdp.workspaceProjection.includeSkillIds.desc'
    },
    {
      path: ['workspaceProjection', 'excludeSkillIds'],
      type: 'string[]',
      defaultValue: [],
      group: 'projection',
      icon: 'playlist_remove',
      labelKey: 'config.fields.mdp.workspaceProjection.excludeSkillIds.label',
      descriptionKey: 'config.fields.mdp.workspaceProjection.excludeSkillIds.desc'
    },
    {
      path: ['connections'],
      type: 'detailCollection',
      defaultValue: {},
      group: 'connections',
      icon: 'dns',
      labelKey: 'config.fields.mdp.connections.label',
      descriptionKey: 'config.fields.mdp.connections.desc',
      detailCollection: {
        collectionKind: 'recordMap',
        keyPlaceholderKey: 'config.editor.newMdpConnectionName',
        createItem: () => ({
          enabled: true,
          title: '',
          description: '',
          hosts: ['ws://127.0.0.1:47372'],
          auth: {}
        }),
        itemFields: mdpConnectionDetailFields,
        summaryControls: [{ kind: 'boolean', path: ['enabled'], checkedValue: true }],
        getItemTitle: (item, itemKey) => {
          const title = typeof item.title === 'string' ? item.title.trim() : ''
          return title !== '' ? title : itemKey
        },
        getItemSubtitle: (_item, itemKey) => itemKey,
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
