import type { LarkPermissionOperation } from './types.js'

import type { LarkPermissionGuide } from './permissions.js'

export const chatPermissionGuideByOperation: Partial<Record<LarkPermissionOperation, LarkPermissionGuide>> = {
  get_chat: {
    operation: 'get_chat',
    summary: '查询群名称、描述、群主等基础信息。',
    requirements: [
      '应用需要开启机器人能力。',
      '机器人或授权用户在群里时可拿到更完整的信息。',
      '跨租户场景会受内部群访问限制。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat/get'
    ]
  },
  get_chat_announcement: {
    operation: 'get_chat_announcement',
    summary: '读取群公告内容和版本信息。',
    requirements: [
      '应用需要开启机器人能力。',
      '机器人或授权用户必须在群组中。',
      '获取内部群公告时，操作者须与群组在同一租户下。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-announcement/get'
    ]
  },
  update_chat_announcement: {
    operation: 'update_chat_announcement',
    summary: '更新群公告文档内容。',
    requirements: [
      '应用需要开启机器人能力。',
      '机器人或授权用户必须在群组中，并具备公告文档阅读权限。',
      '是否允许修改仍受群主/管理员配置和应用群信息权限限制。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-announcement/patch'
    ]
  },
  list_chat_members: {
    operation: 'list_chat_members',
    summary: '查询当前群或指定群的成员列表。',
    requirements: [
      '应用需要开启机器人能力。',
      '机器人或授权用户必须在群组中。',
      '接口不会返回群内机器人成员。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-members/get'
    ]
  },
  manage_chat_members: {
    operation: 'manage_chat_members',
    summary: '向群里拉人或把成员移出群聊。',
    requirements: [
      '应用需要开启机器人能力。',
      '机器人通常需要本身已在群里。',
      '受群管理员/群主配置和群权限策略限制。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-members/create',
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-members/delete'
    ]
  },
  join_chat: {
    operation: 'join_chat',
    summary: '让机器人主动加入公开群。',
    requirements: [
      '应用需要开启机器人能力。',
      '当前仅支持加入公开群。',
      '内部群操作仍受租户限制。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat-members/me_join'
    ]
  },
  get_chat_link: {
    operation: 'get_chat_link',
    summary: '获取群分享链接。',
    requirements: [
      '应用需要开启机器人能力。',
      '机器人或授权用户必须在群组中。',
      '当群开启仅群主/管理员可分享时，需要具备对应角色。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/chat/link'
    ]
  }
}
