import type { SenderProps } from '../@types/sender-props'

export const getSenderRuntimeState = (
  props: Pick<SenderProps, 'forceEffortControl' | 'selectedAdapter' | 'sessionStatus' | 'submitLoading' | 'variant'>
) => {
  const isInlineEdit = props.variant === 'inline-edit'
  const isMac = navigator.platform.includes('Mac')
  const isThinking = !isInlineEdit && props.sessionStatus === 'running'
  const isBusy = isThinking || props.submitLoading === true
  const supportsEffort = props.forceEffortControl === true ||
    props.selectedAdapter === 'codex' || props.selectedAdapter === 'claude-code' ||
    props.selectedAdapter === 'copilot' || props.selectedAdapter === 'opencode'

  return { isInlineEdit, isMac, isThinking, isBusy, supportsEffort }
}
