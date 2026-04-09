import type { LarkMemberIdType, LarkMcpRuntimeEnv } from './types.js'
import { ensureSuccess, resolveDefaultChatId } from './shared.js'
import type { LarkImClient } from './shared.js'

export const createLarkChatManagementActions = (
  env: LarkMcpRuntimeEnv,
  im: LarkImClient
) => ({
  createChat: async (input: {
    name?: string
    description?: string
    ownerId?: string
    userIdList?: string[]
    botIdList?: string[]
    groupMessageType?: 'chat' | 'thread'
    external?: boolean
    setBotManager?: boolean
    userIdType?: LarkMemberIdType
    uuid?: string
  }) => {
    const result = ensureSuccess(
      'Create chat',
      await im.chat.create({
        params: {
          user_id_type: input.userIdType,
          set_bot_manager: input.setBotManager,
          uuid: input.uuid
        },
        data: {
          name: input.name,
          description: input.description,
          owner_id: input.ownerId,
          user_id_list: input.userIdList,
          bot_id_list: input.botIdList,
          group_message_type: input.groupMessageType,
          external: input.external
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  updateChat: async (input: {
    chatId?: string
    name?: string
    description?: string
    ownerId?: string
    addMemberPermission?: string
    shareCardPermission?: string
    atAllPermission?: string
    editPermission?: string
    joinMessageVisibility?: string
    leaveMessageVisibility?: string
    membershipApproval?: string
    groupMessageType?: 'chat' | 'thread'
    urgentSetting?: 'only_owner' | 'all_members'
    videoConferenceSetting?: 'only_owner' | 'all_members'
    pinManageSetting?: 'only_owner' | 'all_members'
    hideMemberCountSetting?: 'all_members' | 'only_owner'
    userIdType?: LarkMemberIdType
  }) => {
    const chatId = resolveDefaultChatId(env, input.chatId)
    const result = ensureSuccess(
      'Update chat',
      await im.chat.update({
        path: { chat_id: chatId },
        params: {
          user_id_type: input.userIdType
        },
        data: {
          name: input.name,
          description: input.description,
          owner_id: input.ownerId,
          add_member_permission: input.addMemberPermission,
          share_card_permission: input.shareCardPermission,
          at_all_permission: input.atAllPermission,
          edit_permission: input.editPermission,
          join_message_visibility: input.joinMessageVisibility,
          leave_message_visibility: input.leaveMessageVisibility,
          membership_approval: input.membershipApproval,
          group_message_type: input.groupMessageType,
          urgent_setting: input.urgentSetting,
          video_conference_setting: input.videoConferenceSetting,
          pin_manage_setting: input.pinManageSetting,
          hide_member_count_setting: input.hideMemberCountSetting
        }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  },
  deleteChat: async (input: {
    chatId: string
    confirmDelete: true
  }) => {
    if (input.confirmDelete !== true) {
      throw new Error('Delete chat requires confirmDelete=true.')
    }

    const chatId = resolveDefaultChatId(env, input.chatId)
    const result = ensureSuccess(
      'Delete chat',
      await im.chat.delete({
        path: { chat_id: chatId }
      })
    ) as { data?: unknown }
    return result.data ?? {}
  }
})
