import { Empty, Spin } from 'antd'
import { useTranslation } from 'react-i18next'

export function WorkspaceDrawerTreeState({
  kind
}: {
  kind: 'empty' | 'error' | 'loading'
}) {
  const { t } = useTranslation()

  if (kind === 'loading') {
    return (
      <div className='chat-workspace-drawer__loading'>
        <Spin size='small' />
        <span>{t('chat.contextPickerLoading')}</span>
      </div>
    )
  }

  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={t(kind === 'error' ? 'chat.contextPickerLoadFailed' : 'chat.contextPickerEmpty')}
    />
  )
}
