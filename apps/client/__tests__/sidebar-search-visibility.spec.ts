import { describe, expect, it } from 'vitest'

import { shouldShowSidebarSearchRow } from '#~/components/sidebar/sidebar-search-visibility'

describe('sidebar-search-visibility', () => {
  it('always shows the search row when threshold is disabled', () => {
    expect(shouldShowSidebarSearchRow({
      hasActiveSearchControls: false,
      isBatchMode: false,
      isSearchActionsOpen: false,
      sessionCount: 0,
      threshold: 0
    })).toBe(true)
  })

  it('hides the search row when session count does not exceed the threshold', () => {
    expect(shouldShowSidebarSearchRow({
      hasActiveSearchControls: false,
      isBatchMode: false,
      isSearchActionsOpen: false,
      sessionCount: 8,
      threshold: 8
    })).toBe(false)
  })

  it('shows the search row once the session count exceeds the threshold', () => {
    expect(shouldShowSidebarSearchRow({
      hasActiveSearchControls: false,
      isBatchMode: false,
      isSearchActionsOpen: false,
      sessionCount: 9,
      threshold: 8
    })).toBe(true)
  })

  it('keeps the search row visible while filters, search actions, or batch mode are active', () => {
    expect(shouldShowSidebarSearchRow({
      hasActiveSearchControls: true,
      isBatchMode: false,
      isSearchActionsOpen: false,
      sessionCount: 2,
      threshold: 8
    })).toBe(true)

    expect(shouldShowSidebarSearchRow({
      hasActiveSearchControls: false,
      isBatchMode: false,
      isSearchActionsOpen: true,
      sessionCount: 2,
      threshold: 8
    })).toBe(true)

    expect(shouldShowSidebarSearchRow({
      hasActiveSearchControls: false,
      isBatchMode: true,
      isSearchActionsOpen: false,
      sessionCount: 2,
      threshold: 8
    })).toBe(true)
  })
})
