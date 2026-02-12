import './LoadingState.scss'

import { Spin } from 'antd'

export function LoadingState() {
  return (
    <div className='knowledge-base-view__loading'>
      <Spin />
    </div>
  )
}
