import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import useSWR from 'swr'

import type { ConfigResponse, SessionEntryContext } from '@vibe-forge/types'

import { getConfig } from '#~/api'
import {
  buildBrowserSessionEntryContext,
  stripClientBase
} from '#~/hooks/mdp-browser-runtime/browser-entry-context'

export function useBrowserSessionEntryContext(): SessionEntryContext {
  const location = useLocation()
  const { data: configRes } = useSWR<ConfigResponse>('/api/config', getConfig)

  return useMemo(() => buildBrowserSessionEntryContext({
    pathname: stripClientBase(location.pathname),
    search: location.search,
    href: window.location.href,
    config: configRes?.sources?.merged
  }), [configRes?.sources?.merged, location.pathname, location.search])
}
