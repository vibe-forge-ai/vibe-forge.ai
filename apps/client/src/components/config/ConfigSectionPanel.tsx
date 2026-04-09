import '../ConfigView.scss'

import type { ReactNode } from 'react'

import type { ConfigUiSection } from '@vibe-forge/types'

import { SectionForm } from './ConfigSectionForm'
import type { FieldSpec } from './configSchema'
import type { TranslationFn } from './configUtils'

export function ConfigSectionPanel({
  sectionKey,
  title,
  icon,
  fields,
  uiSection,
  value,
  onChange,
  mergedModelServices,
  mergedAdapters,
  selectedModelService,
  headerExtra,
  t,
  className
}: {
  sectionKey: string
  title: ReactNode
  icon?: ReactNode
  fields?: FieldSpec[]
  uiSection?: ConfigUiSection
  value: unknown
  onChange: (nextValue: unknown) => void
  mergedModelServices: Record<string, unknown>
  mergedAdapters: Record<string, unknown>
  selectedModelService?: string
  headerExtra?: ReactNode
  t: TranslationFn
  className?: string
}) {
  const wrapClassName = ['config-view__editor-wrap', className].filter(Boolean).join(' ')
  const hasHeader = title != null || icon != null || headerExtra != null
  return (
    <div className={wrapClassName}>
      {hasHeader && (
        <div className='config-view__section-header'>
          <div className='config-view__section-title'>
            {icon != null && (
              <span className='material-symbols-rounded config-view__section-icon'>
                {icon}
              </span>
            )}
            <span>{title}</span>
          </div>
          {headerExtra}
        </div>
      )}
      <div className='config-view__card'>
        <SectionForm
          sectionKey={sectionKey}
          fields={fields}
          uiSection={uiSection}
          value={value}
          onChange={onChange}
          mergedModelServices={mergedModelServices}
          mergedAdapters={mergedAdapters}
          selectedModelService={selectedModelService}
          t={t}
        />
      </div>
    </div>
  )
}
