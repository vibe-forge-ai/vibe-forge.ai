import { Empty } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

export function SearchView() {
  const { t } = useTranslation()
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <Empty description={t('common.searchPlaceholder', 'Global Search coming soon...')} />
    </div>
  )
}
