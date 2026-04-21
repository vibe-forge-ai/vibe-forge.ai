import { useQueryParams } from '#~/hooks/useQueryParams.js'

export function useSenderHeaderQueryState() {
  const { values, update } = useQueryParams<{
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

  return {
    isHeaderCollapsed: values.senderHeader === 'collapsed',
    setHeaderCollapsed: (collapsed: boolean) => update({ senderHeader: collapsed ? 'collapsed' : '' })
  }
}
