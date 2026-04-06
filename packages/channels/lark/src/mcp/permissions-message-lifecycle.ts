import type { LarkPermissionOperation } from './types.js'

import type { LarkPermissionGuide } from './permissions.js'

export const messageLifecyclePermissionGuideByOperation: Partial<Record<LarkPermissionOperation, LarkPermissionGuide>> = {
  reply_message: {
    operation: 'reply_message',
    summary: '回复一条现有消息。',
    requirements: [
      '应用需要开启机器人能力。',
      '回复私聊消息时，机器人需要对目标用户具备可用性。',
      '回复群组消息时，机器人必须在群中。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/reply'
    ]
  },
  update_message: {
    operation: 'update_message',
    summary: '编辑一条已发送的文本或富文本消息。',
    requirements: [
      '应用需要开启机器人能力。',
      '当前仅支持编辑文本和富文本消息。',
      '通常只能更新机器人自己发送且仍然可编辑的消息。'
    ],
    docs: [
      'https://open.feishu.cn/api-explorer?from=op_doc_tab&apiName=update&project=im&resource=message&version=v1'
    ]
  },
  patch_message: {
    operation: 'patch_message',
    summary: '更新一条共享卡片消息内容。',
    requirements: [
      '应用需要开启机器人能力。',
      '仅支持更新未撤回的共享卡片消息，并需满足 update_multi 等飞书卡片约束。',
      '单条消息更新频控与 14 天窗口限制仍然生效。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/patch'
    ]
  },
  push_follow_up: {
    operation: 'push_follow_up',
    summary: '向一条消息追加 follow-up 建议。',
    requirements: [
      '应用需要开启机器人能力。',
      '目标消息需要仍然可访问。',
      'follow-up 内容需要符合飞书消息建议格式要求。'
    ],
    docs: [
      'https://open.feishu.cn/api-explorer?from=op_doc_tab&apiName=push_follow_up&project=im&resource=message&version=v1'
    ]
  },
  get_message_read_users: {
    operation: 'get_message_read_users',
    summary: '查询一条机器人消息的已读用户列表。',
    requirements: [
      '应用需要开启机器人能力。',
      '只能查询机器人自己发送且发送时间不超过 7 天的消息。',
      '查询时机器人仍需在目标会话内。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/read_users'
    ]
  }
}
