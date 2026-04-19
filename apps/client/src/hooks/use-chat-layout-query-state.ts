import { useQueryParams } from '#~/hooks/useQueryParams.js'

type ChatLayoutMode = 'workspace'

const toChatLayoutMode = (value: string): ChatLayoutMode | undefined => {
  return value === 'workspace' ? value : undefined
}

export function useChatLayoutQueryState() {
  const { values, update } = useQueryParams<{
    layout: string
  }>({
    keys: ['layout'],
    defaults: {
      layout: ''
    },
    omit: {
      layout: value => value === ''
    }
  })

  const activeLayout = toChatLayoutMode(values.layout)

  return {
    activeLayout,
    isWorkspaceDrawerOpen: activeLayout === 'workspace',
    setWorkspaceDrawerOpen: (open: boolean) => update({ layout: open ? 'workspace' : '' })
  }
}
