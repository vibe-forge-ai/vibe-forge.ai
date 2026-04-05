import { useEffect } from 'react'

export const useSenderReferenceFocusRestore = ({
  focusRestore,
  referenceActions
}: {
  focusRestore: { queueEditorFocusRestore: () => void }
  referenceActions: {
    shouldRestoreFocus: boolean
    clearReferenceFocusRestore: () => void
  }
}) => {
  useEffect(() => {
    if (!referenceActions.shouldRestoreFocus) {
      return
    }

    focusRestore.queueEditorFocusRestore()
    referenceActions.clearReferenceFocusRestore()
  }, [focusRestore, referenceActions])
}
