import type { LarkPermissionOperation } from './types.js'

import type { LarkPermissionGuide } from './permissions.js'

export const messageAdvancedPermissionGuideByOperation: Partial<Record<LarkPermissionOperation, LarkPermissionGuide>> = {
  merge_forward_messages: {
    operation: 'merge_forward_messages',
    summary: '将多条消息合并转发到新的会话。',
    requirements: [
      '应用需要开启机器人能力。',
      '机器人必须对待转发消息和目标会话都具备可见性。',
      '被转发消息必须是真实存在且仍可访问的消息。'
    ],
    docs: [
      'https://open.feishu.cn/api-explorer?from=op_doc_tab&apiName=merge_forward&project=im&resource=message&version=v1'
    ]
  },
  forward_thread: {
    operation: 'forward_thread',
    summary: '将一个 thread 转发到新的会话。',
    requirements: [
      '应用需要开启机器人能力。',
      '机器人必须能访问目标 thread 和目标会话。',
      '目标 receive_id_type 支持 chat_id、thread_id 等可转发容器。'
    ],
    docs: [
      'https://open.feishu.cn/api-explorer?from=op_doc_tab&apiName=forward&project=im&resource=thread&version=v1'
    ]
  },
  send_urgent_app: {
    operation: 'send_urgent_app',
    summary: '对已发送消息发起应用内加急。',
    requirements: [
      '应用需要开启机器人能力。',
      '只能加急机器人自己发送的消息。',
      '用户未读加急上限和群内可见性限制仍然生效。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/urgent_app'
    ]
  },
  send_urgent_sms: {
    operation: 'send_urgent_sms',
    summary: '对已发送消息发起短信加急。',
    requirements: [
      '应用需要开启机器人能力。',
      '只能加急机器人自己发送的消息。',
      '会消耗企业短信/电话加急额度，应谨慎调用。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/urgent_sms'
    ]
  },
  send_urgent_phone: {
    operation: 'send_urgent_phone',
    summary: '对已发送消息发起电话加急。',
    requirements: [
      '应用需要开启机器人能力。',
      '只能加急机器人自己发送的消息。',
      '会消耗企业短信/电话加急额度，应谨慎调用。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/urgent_phone'
    ]
  }
}
