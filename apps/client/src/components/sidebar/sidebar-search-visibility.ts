export const shouldShowSidebarSearchRow = ({
  hasActiveSearchControls,
  isBatchMode,
  isSearchActionsOpen,
  sessionCount,
  threshold
}: {
  hasActiveSearchControls: boolean
  isBatchMode: boolean
  isSearchActionsOpen: boolean
  sessionCount: number
  threshold: number
}) => {
  if (threshold <= 0) return true
  if (hasActiveSearchControls || isBatchMode || isSearchActionsOpen) return true

  return sessionCount > threshold
}
