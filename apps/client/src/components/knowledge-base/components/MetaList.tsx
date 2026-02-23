import './MetaList.scss'

type MetaListProps = {
  items: string[]
}

export function MetaList({ items }: MetaListProps) {
  return (
    <div className='knowledge-base-view__meta-list'>
      {items.map(item => (
        <div key={item} className='knowledge-base-view__meta-item'>
          <span className='material-symbols-rounded knowledge-base-view__meta-item-icon'>check_circle</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  )
}
