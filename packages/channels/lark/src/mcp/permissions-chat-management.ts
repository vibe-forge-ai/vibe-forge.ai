import type { LarkPermissionOperation } from './types.js'

import type { LarkPermissionGuide } from './permissions.js'

export const chatManagementPermissionGuideByOperation: Partial<Record<LarkPermissionOperation, LarkPermissionGuide>> = {
  create_chat: {
    operation: 'create_chat',
    summary: '创建一个新的群聊。',
    requirements: [
      '应用需要开启机器人能力。',
      '如需直接拉用户进群，机器人需要对这些用户具备可用性。',
      '部分群配置仍受企业和群权限策略限制。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat/create'
    ]
  },
  update_chat: {
    operation: 'update_chat',
    summary: '更新群名称、描述、配置等信息。',
    requirements: [
      '应用需要开启机器人能力。',
      '机器人是否可改全部配置，取决于群角色和“更新应用所创建群的群信息”等权限。',
      '部分配置组合存在联动约束，应按飞书群权限规则设置。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat/update'
    ]
  },
  delete_chat: {
    operation: 'delete_chat',
    summary: '解散一个群聊。',
    requirements: [
      '应用需要开启机器人能力。',
      'tenant_access_token 模式下，通常要求机器人是群主，或是创建者且具备相应权限。',
      '这是破坏性操作，只应在明确确认后调用。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat/delete'
    ]
  }
}
