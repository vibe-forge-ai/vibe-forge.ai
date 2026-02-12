import './TabLabel.scss'

type TabLabelProps = {
  icon: string
  label: string
}

export function TabLabel({ icon, label }: TabLabelProps) {
  return (
    <span className='knowledge-base-view__tab-label'>
      <span className='material-symbols-rounded knowledge-base-view__tab-icon'>{icon}</span>
      <span>{label}</span>
    </span>
  )
}
