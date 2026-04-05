import { useEffect } from 'react'

export const useSenderReferenceFocusRestore = ({
  focusRestore,
  referenceActions
}: {
  focusRestore: { queueTextareaFocusRestore: () => void }
  referenceActions: {
    shouldRestoreFocus: boolean
    clearReferenceFocusRestore: () => void
  }
}) => {
  useEffect(() => {
    if (!referenceActions.shouldRestoreFocus) {
      return
    }

    focusRestore.queueTextareaFocusRestore()
    referenceActions.clearReferenceFocusRestore()
  }, [focusRestore, referenceActions])
}
