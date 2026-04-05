import type { SenderProps } from '../@types/sender-props'

import { shouldHideSenderForInteraction } from './interaction-request'

export const getSenderInteractionState = ({
  interactionRequest,
  isInlineEdit
}: {
  interactionRequest: SenderProps['interactionRequest']
  isInlineEdit: boolean
}) => {
  const hideSender = isInlineEdit ? false : shouldHideSenderForInteraction(interactionRequest)
  const permissionContext = interactionRequest?.payload.kind === 'permission'
    ? interactionRequest.payload.permissionContext
    : undefined

  return { hideSender, permissionContext }
}
