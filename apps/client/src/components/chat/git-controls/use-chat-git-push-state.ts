import { useState } from 'react'

export function useChatGitPushState() {
  const [pushModalOpen, setPushModalOpen] = useState(false)
  const [pushForce, setPushForce] = useState(false)

  const resetPushState = () => {
    setPushModalOpen(false)
    setPushForce(false)
  }

  return {
    pushForce,
    pushModalOpen,
    resetPushState,
    setPushForce,
    setPushModalOpen
  }
}
