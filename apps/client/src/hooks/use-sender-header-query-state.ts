import { useAtomValue } from 'jotai'

import { useQueryParams } from '#~/hooks/useQueryParams.js'
import { senderHeaderDisplayAtom } from '#~/store/index.js'

const isSenderHeaderQueryValue = (
  value: string | null
): value is 'collapsed' | 'expanded' => {
  return value === 'collapsed' || value === 'expanded'
}

export function useSenderHeaderQueryState() {
  const senderHeaderDisplay = useAtomValue(senderHeaderDisplayAtom)
  const { update, searchParams } = useQueryParams<{
    senderHeader: string
  }>({
    keys: ['senderHeader'],
    defaults: {
      senderHeader: ''
    },
    omit: {
      senderHeader: value => value === ''
    }
  })

  const rawSenderHeader = searchParams.get('senderHeader')
  const senderHeaderState = isSenderHeaderQueryValue(rawSenderHeader)
    ? rawSenderHeader
    : senderHeaderDisplay

  return {
    isHeaderCollapsed: senderHeaderState === 'collapsed',
    setHeaderCollapsed: (collapsed: boolean) => update({ senderHeader: collapsed ? 'collapsed' : 'expanded' })
  }
}
