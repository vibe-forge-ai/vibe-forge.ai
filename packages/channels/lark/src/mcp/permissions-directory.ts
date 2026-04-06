import type { LarkPermissionOperation } from './types.js'

import type { LarkPermissionGuide } from './permissions.js'

export const directoryPermissionGuideByOperation: Partial<Record<LarkPermissionOperation, LarkPermissionGuide>> = {
  get_user: {
    operation: 'get_user',
    summary: '读取单个飞书用户的通讯录资料。',
    requirements: [
      '应用需要具备通讯录用户读取权限。',
      'tenant_access_token 模式下，返回结果受应用的通讯录可见范围限制。',
      '不同字段的可见性还会继续受到企业通讯录权限控制。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/contact-v3/user/get'
    ]
  },
  resolve_user_ids: {
    operation: 'resolve_user_ids',
    summary: '通过邮箱或手机号解析用户 ID。',
    requirements: [
      '应用需要具备通讯录用户读取权限。',
      '只有在当前应用可见范围内的用户，才会返回对应的用户 ID。',
      '输入邮箱或手机号不存在时，结果会返回空列表。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/contact-v3/user/batch_get_id'
    ]
  },
  find_users_by_department: {
    operation: 'find_users_by_department',
    summary: '按部门读取直属用户列表。',
    requirements: [
      '应用需要具备目标部门的通讯录可见权限。',
      '根部门 department_id=0 时，需要全员通讯录权限。',
      '返回结果会按应用或用户的组织架构可见范围进行过滤。'
    ],
    docs: [
      'https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/contact-v3/user/find_by_department'
    ]
  }
}
