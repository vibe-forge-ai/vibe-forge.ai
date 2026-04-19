import React from 'react'

const QUERY_SYNC_DELAY_MS = 160

export function useSkillMarketQueryInput({
  query,
  onQueryChange
}: {
  query: string
  onQueryChange: (value: string) => void
}) {
  const [draftQuery, setDraftQuery] = React.useState(query)

  React.useEffect(() => {
    setDraftQuery(previous => previous === query ? previous : query)
  }, [query])

  React.useEffect(() => {
    if (draftQuery === query) return

    const timer = window.setTimeout(() => {
      React.startTransition(() => {
        onQueryChange(draftQuery)
      })
    }, QUERY_SYNC_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [draftQuery, onQueryChange, query])

  const flushDraftQuery = React.useCallback((nextQuery?: string) => {
    const resolvedQuery = nextQuery ?? draftQuery
    if (resolvedQuery === query) return

    React.startTransition(() => {
      onQueryChange(resolvedQuery)
    })
  }, [draftQuery, onQueryChange, query])

  return {
    draftQuery,
    flushDraftQuery,
    setDraftQuery
  }
}
