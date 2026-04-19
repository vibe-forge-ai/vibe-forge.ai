import { Empty } from 'antd'
import { useTranslation } from 'react-i18next'

export function WorkspaceDrawerTreeState({
  kind
}: {
  kind: 'empty' | 'error'
}) {
  const { t } = useTranslation()

  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={t(kind === 'error' ? 'chat.contextPickerLoadFailed' : 'chat.contextPickerEmpty')}
    />
  )
}
