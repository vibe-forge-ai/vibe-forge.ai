import './KnowledgeList.scss'

import { List } from 'antd'
import type { ReactNode } from 'react'

type KnowledgeListProps<T> = {
  data: T[]
  renderItem: (item: T) => ReactNode
}

export function KnowledgeList<T>({ data, renderItem }: KnowledgeListProps<T>) {
  return (
    <List
      className='knowledge-base-view__list'
      dataSource={data}
      renderItem={(item) => renderItem(item)}
    />
  )
}
