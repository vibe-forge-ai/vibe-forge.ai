import './SenderSessionTargetBar.scss'

import { Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { EntitySummary, SpecSummary, WorkspaceSummary } from '#~/api.js'
import { DEFAULT_CHAT_SESSION_TARGET_DRAFT, createChatSessionTargetDraft } from '#~/hooks/chat/chat-session-target'
import type {
  ChatSessionTargetDraft,
  ChatSessionTargetResource,
  ChatSessionTargetType
} from '#~/hooks/chat/chat-session-target'

type SelectableTargetType = Exclude<ChatSessionTargetType, 'default'>

const modeIcons: Record<ChatSessionTargetType, string> = {
  default: 'radio_button_checked',
  workspace: 'workspaces',
  entity: 'group_work',
  spec: 'account_tree'
}

const selectableTypes: SelectableTargetType[] = ['workspace', 'entity', 'spec']
const menuKeySeparator = '::'

const toResource = (item: WorkspaceSummary | EntitySummary | SpecSummary): ChatSessionTargetResource => ({
  id: item.id,
  name: item.name,
  description: item.description,
  path: 'path' in item ? item.path : item.id
})

export function SenderSessionTargetBar({
  draft,
  locked,
  disabled,
  onChange
}: {
  draft: ChatSessionTargetDraft
  locked: boolean
  disabled?: boolean
  onChange: (target: ChatSessionTargetDraft) => void
}) {
  const { t } = useTranslation()
  const { data: specsRes } = useSWR<{ specs: SpecSummary[] }>('/api/ai/specs')
  const { data: entitiesRes } = useSWR<{ entities: EntitySummary[] }>('/api/ai/entities')
  const { data: workspacesRes } = useSWR<{ workspaces: WorkspaceSummary[] }>('/api/ai/workspaces')

  const resourcesByType = useMemo<Record<SelectableTargetType, ChatSessionTargetResource[]>>(() => ({
    workspace: (workspacesRes?.workspaces ?? []).map(toResource),
    entity: (entitiesRes?.entities ?? []).map(toResource),
    spec: (specsRes?.specs ?? []).map(toResource)
  }), [entitiesRes?.entities, specsRes?.specs, workspacesRes?.workspaces])

  const activeType = draft.type
  const isControlDisabled = locked || disabled === true
  const selectedLabel = draft.label ?? draft.name
  const selectedText = activeType === 'default'
    ? null
    : selectedLabel ?? t(`chat.sessionTarget.placeholders.${activeType}`)

  const handleSelect = (type: ChatSessionTargetType, resource?: ChatSessionTargetResource) => {
    if (isControlDisabled) return

    if (type === 'default') {
      onChange({ ...DEFAULT_CHAT_SESSION_TARGET_DRAFT })
      return
    }

    onChange(
      resource == null
        ? { type }
        : createChatSessionTargetDraft(type, resource)
    )
  }

  const menuItems = useMemo<MenuProps['items']>(() => [
    {
      key: 'default',
      label: t('chat.sessionTarget.modes.default'),
      icon: <span className='material-symbols-rounded sender-session-target__menu-icon'>{modeIcons.default}</span>
    },
    { type: 'divider' },
    ...selectableTypes.map(type => ({
      key: type,
      label: t(`chat.sessionTarget.modes.${type}`),
      icon: <span className='material-symbols-rounded sender-session-target__menu-icon'>{modeIcons[type]}</span>,
      popupClassName: 'sender-session-target__submenu-popup',
      children: resourcesByType[type].length > 0
        ? resourcesByType[type].map(resource => ({
          key: `${type}${menuKeySeparator}${type === 'workspace' ? resource.id : resource.name}`,
          label: (
            <span className='sender-session-target__menu-item'>
              <span className='sender-session-target__menu-item-name'>{resource.name}</span>
              {(resource.description ?? resource.path) != null && (
                <span className='sender-session-target__menu-item-desc'>{resource.description ?? resource.path}</span>
              )}
            </span>
          )
        }))
        : [{
          key: `${type}${menuKeySeparator}__empty`,
          label: t(`chat.sessionTarget.empty.${type}`),
          disabled: true
        }]
    }))
  ], [resourcesByType, t])

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    const rawKey = String(key)
    if (rawKey === 'default') {
      handleSelect('default')
      return
    }

    const [type, resourceValue] = rawKey.split(menuKeySeparator) as [SelectableTargetType | undefined, string?]
    if (type == null || !selectableTypes.includes(type) || resourceValue == null || resourceValue === '__empty') {
      return
    }

    const resource = resourcesByType[type].find(item => (type === 'workspace' ? item.id : item.name) === resourceValue)
    handleSelect(type, resource)
  }

  return (
    <div className={`sender-session-target ${locked ? 'is-locked' : ''}`}>
      <div className='sender-session-target__controls'>
        <Dropdown
          menu={{
            items: menuItems,
            onClick: handleMenuClick,
            className: 'sender-session-target__dropdown-menu',
            expandIcon: (
              <span className='material-symbols-rounded sender-session-target__submenu-chevron'>
                chevron_right
              </span>
            )
          }}
          trigger={['click']}
          placement='topLeft'
          overlayClassName='sender-session-target__dropdown'
          disabled={isControlDisabled}
        >
          <button
            type='button'
            className='sender-session-target__trigger'
            disabled={isControlDisabled}
            aria-label={t('chat.sessionTarget.title')}
          >
            <span className='material-symbols-rounded sender-session-target__trigger-icon'>
              {modeIcons[activeType]}
            </span>
            <span className='sender-session-target__trigger-copy'>
              <span className='sender-session-target__trigger-mode'>
                {t(`chat.sessionTarget.modes.${activeType}`)}
              </span>
              {selectedText != null && (
                <span className='sender-session-target__trigger-value'>{selectedText}</span>
              )}
            </span>
            <span className='material-symbols-rounded sender-session-target__trigger-chevron'>expand_more</span>
          </button>
        </Dropdown>
      </div>
    </div>
  )
}
