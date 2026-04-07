import { Select } from 'antd'
import type { SelectProps } from 'antd'

interface SidebarHeaderSelectFieldProps extends SelectProps {
  icon: string
}

export function SidebarHeaderSelectField({
  className,
  icon,
  ...selectProps
}: SidebarHeaderSelectFieldProps) {
  return (
    <div className='toolbar-filter-control'>
      <span className='material-symbols-rounded toolbar-filter-icon'>{icon}</span>
      <Select
        className={className == null || className === ''
          ? 'toolbar-filter-select'
          : `toolbar-filter-select ${className}`}
        {...selectProps}
      />
    </div>
  )
}
