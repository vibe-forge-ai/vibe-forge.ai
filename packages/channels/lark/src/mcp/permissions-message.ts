import type { LarkPermissionOperation } from './types.js'

import type { LarkPermissionGuide } from './permissions.js'

export const messagePermissionGuideByOperation: Partial<Record<LarkPermissionOperation, LarkPermissionGuide>> = {
  send_message: {
    operation: 'send_message',
    summary: '向用户或群聊发送消息。',
    requirements: [
      '应用需要开启机器人能力。',
      '向用户发消息时，机器人需要对该用户具备可用性。',
      '向群发消息时，机器人必须在群组中。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create'
    ]
  },
  send_file: {
    operation: 'send_file',
    summary: '上传文件并作为消息发送到会话。',
    requirements: [
      '应用需要开启机器人能力。',
      '上传到 IM 的文件不得为空，且大小不得超过 30MB。',
      '发送文件消息时仍需满足消息发送的会话可见性约束。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/file/create',
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create'
    ]
  },
  send_image: {
    operation: 'send_image',
    summary: '上传本地图片并作为消息发送到会话。',
    requirements: [
      '应用需要开启机器人能力。',
      '支持 JPEG、PNG、WEBP、GIF、TIFF、BMP、ICO 格式图片。',
      '图片不得为空，且大小不得超过 10MB。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/image/create',
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create'
    ]
  },
  send_raw_message: {
    operation: 'send_raw_message',
    summary: '发送任意 Lark msg_type 的原始消息内容。',
    requirements: [
      '应用需要开启机器人能力。',
      '消息内容必须符合对应 msg_type 的 content 格式要求。',
      '向用户或群发消息时，仍然受消息发送可见性和会话成员约束。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create'
    ]
  },
  send_template_card: {
    operation: 'send_template_card',
    summary: '通过消息卡片模板发送消息。',
    requirements: [
      '应用需要开启机器人能力。',
      '模板卡片需要先在飞书开放平台配置可用模板。',
      '模板变量结构必须与模板定义匹配。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create'
    ]
  },
  reply_template_card: {
    operation: 'reply_template_card',
    summary: '通过模板卡片回复一条消息。',
    requirements: [
      '应用需要开启机器人能力。',
      '回复私聊消息时，机器人需要对用户具备可用性。',
      '回复群组消息时，机器人必须在群中。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/reply'
    ]
  },
  update_template_card: {
    operation: 'update_template_card',
    summary: '更新一条已有的模板卡片消息。',
    requirements: [
      '应用需要开启机器人能力。',
      '目标消息必须是可更新的模板卡片消息。',
      '通常只能更新机器人自己发送且仍然可见的卡片消息。'
    ],
    docs: [
      'https://open.feishu.cn/api-explorer?from=op_doc_tab&apiName=update&project=im&resource=message&version=v1'
    ]
  },
  list_messages: {
    operation: 'list_messages',
    summary: '读取会话历史消息。',
    requirements: [
      '应用需要开启机器人能力。',
      '读取群聊历史消息时，机器人必须在群内。',
      '若读取群消息，应用还可能需要“获取群组中所有消息”权限。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/list'
    ]
  },
  manage_message_reaction: {
    operation: 'manage_message_reaction',
    summary: '给消息添加或删除表情回复。',
    requirements: [
      '应用需要开启机器人能力。',
      '目标消息必须真实存在且未被撤回。',
      '添加或删除 reaction 时，操作者必须在消息所在会话内。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message-reaction/create',
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message-reaction/delete'
    ]
  },
  list_message_reactions: {
    operation: 'list_message_reactions',
    summary: '读取消息上的表情回复。',
    requirements: [
      '应用需要开启机器人能力。',
      '目标消息必须真实存在且未被撤回。',
      '查询 reaction 时，操作者必须在消息所在会话内。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message-reaction/list'
    ]
  },
  manage_pin: {
    operation: 'manage_pin',
    summary: 'Pin 或移除 Pin 消息。',
    requirements: [
      '应用需要开启机器人能力。',
      '机器人必须在目标群组中。',
      '不能对操作者不可见的消息执行 Pin 操作。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/pin/create',
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/pin/delete'
    ]
  },
  list_pins: {
    operation: 'list_pins',
    summary: '读取群内 Pin 消息列表。',
    requirements: [
      '应用需要开启机器人能力。',
      '机器人必须在目标群组中。',
      '返回结果按 Pin 创建时间降序排列。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/pin/list'
    ]
  },
  download_file: {
    operation: 'download_file',
    summary: '下载当前应用自己上传的文件。',
    requirements: [
      '应用需要开启机器人能力。',
      '只能下载机器人自己上传的文件。',
      '单个下载资源大小不能超过 100MB。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/file/get'
    ]
  },
  download_image: {
    operation: 'download_image',
    summary: '下载当前应用自己上传的 message 图片。',
    requirements: [
      '应用需要开启机器人能力。',
      '只能下载机器人自己上传且类型为 message 的图片。',
      '用户发送的图片资源需要改用消息资源下载接口。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/image/get'
    ]
  },
  download_message_resource: {
    operation: 'download_message_resource',
    summary: '下载可见消息里的图片、文件、音频或视频资源。',
    requirements: [
      '应用需要开启机器人能力。',
      '机器人和目标消息必须在同一会话中。',
      '当前仅支持 100MB 以内的消息资源下载。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message-resource/get'
    ]
  }
}
