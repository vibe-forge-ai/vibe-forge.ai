/* eslint-disable max-lines -- section panel keeps route sync and focus management together for now. */
import '../ConfigView.scss'

import { Button, Tooltip } from 'antd'
import type { ReactNode } from 'react'
import { useLayoutEffect, useRef } from 'react'

import type { ConfigUiSection } from '@vibe-forge/types'

import { SectionForm } from './ConfigSectionForm'
import type { ConfigDetailRoute } from './configDetail'
import {
  getConfigDetailRouteKey,
  getSectionFields,
  parseConfigDetailRoute,
  resolveConfigDetailRouteMeta,
  serializeConfigDetailRoute
} from './configDetail'
import type { FieldSpec } from './configSchema'
import type { TranslationFn } from './configUtils'
import { toLabel } from './record-editors/schemaRecordUtils'

export function ConfigSectionPanel({
  sectionKey,
  title,
  icon,
  headerLeading,
  fields,
  uiSection,
  value,
  resolvedValue,
  onChange,
  mergedModelServices,
  mergedAdapters,
  selectedModelService,
  worktreeEnvironmentOptions,
  detailQuery = '',
  onDetailQueryChange,
  headerExtra,
  t,
  className
}: {
  sectionKey: string
  title?: ReactNode
  icon?: ReactNode
  headerLeading?: ReactNode
  fields?: FieldSpec[]
  uiSection?: ConfigUiSection
  value: unknown
  resolvedValue?: unknown
  onChange: (nextValue: unknown) => void
  mergedModelServices: Record<string, unknown>
  mergedAdapters: Record<string, unknown>
  selectedModelService?: string
  worktreeEnvironmentOptions?: Array<{ value: string; label: ReactNode }>
  detailQuery?: string
  onDetailQueryChange?: (nextQuery: string) => void
  headerExtra?: ReactNode
  t: TranslationFn
  className?: string
}) {
  const wrapClassName = ['config-view__editor-wrap', className].filter(Boolean).join(' ')
  const hasHeading = title != null || icon != null
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const scrollPositionsRef = useRef<Record<string, number>>({})
  const resolvedFields = getSectionFields(sectionKey, fields)
  const detailRoute = parseConfigDetailRoute({
    fields: resolvedFields,
    raw: detailQuery
  })
  const detailMeta = resolveConfigDetailRouteMeta({
    sectionKey,
    fields: resolvedFields,
    value,
    resolvedValue,
    route: detailRoute,
    detailContext: {
      mergedModelServices,
      mergedAdapters,
      t
    },
    t
  })
  const currentViewKey = getConfigDetailRouteKey(detailRoute)
  const hasHeader = hasHeading || headerLeading != null || headerExtra != null || detailMeta != null
  const headerClassName = [
    'config-view__section-header',
    !hasHeading ? 'config-view__section-header--actions-only' : ''
  ].filter(Boolean).join(' ')

  const storeCurrentScroll = () => {
    const node = scrollRef.current
    if (node == null) return
    scrollPositionsRef.current[currentViewKey] = node.scrollTop
  }

  const handleOpenDetail = (nextRoute: ConfigDetailRoute) => {
    storeCurrentScroll()
    onDetailQueryChange?.(serializeConfigDetailRoute(nextRoute))
  }

  const handleCloseDetail = () => {
    storeCurrentScroll()
    if ((detailRoute?.nestedPath?.length ?? 0) > 0 && detailRoute != null) {
      onDetailQueryChange?.(serializeConfigDetailRoute({
        ...detailRoute,
        nestedPath: detailRoute.nestedPath?.slice(0, -1) ?? []
      }))
      return
    }
    onDetailQueryChange?.('')
  }

  const nestedSegments = detailRoute?.nestedPath ?? []
  const nestedBreadcrumbs = nestedSegments.map((segment, index) => {
    const label = index === 0 && segment === 'accounts'
      ? t('config.accounts.title')
      : toLabel(segment)
    const isCurrent = index === nestedSegments.length - 1
    return {
      key: `${segment}:${index}`,
      label,
      isCurrent,
      onClick: isCurrent
        ? undefined
        : () => {
          if (detailRoute == null) return
          storeCurrentScroll()
          onDetailQueryChange?.(serializeConfigDetailRoute({
            ...detailRoute,
            nestedPath: nestedSegments.slice(0, index + 1)
          }))
        }
    }
  })
  const breadcrumbItems = (() => {
    if (detailMeta == null) return []

    const items: Array<{ key: string; label: ReactNode; isCurrent?: boolean; onClick?: () => void }> = [
      {
        key: 'section',
        label: title
      },
      {
        key: 'item',
        label: detailMeta.itemLabel,
        isCurrent: nestedBreadcrumbs.length === 0,
        ...(nestedBreadcrumbs.length > 0
          ? {
            onClick: () => {
              storeCurrentScroll()
              onDetailQueryChange?.(serializeConfigDetailRoute({
                ...detailRoute!,
                nestedPath: []
              }))
            }
          }
          : {})
      }
    ]

    return [...items, ...nestedBreadcrumbs]
  })()

  useLayoutEffect(() => {
    const node = scrollRef.current
    if (node == null) return
    node.scrollTop = scrollPositionsRef.current[currentViewKey] ?? 0
  }, [currentViewKey])

  return (
    <div className={wrapClassName}>
      {hasHeader && (
        <div className={headerClassName}>
          {hasHeading
            ? detailMeta == null
              ? (
                <div className='config-view__section-title'>
                  {headerLeading}
                  {icon != null && (
                    <span className='material-symbols-rounded config-view__section-icon'>
                      {icon}
                    </span>
                  )}
                  <span>{title}</span>
                </div>
              )
              : (
                <div className='config-view__detail-trail'>
                  {headerLeading}
                  <Tooltip title={t('config.detail.back')}>
                    <Button
                      size='small'
                      type='text'
                      className='config-view__detail-back'
                      aria-label={t('config.detail.back')}
                      icon={<span className='material-symbols-rounded'>chevron_left</span>}
                      onClick={handleCloseDetail}
                    />
                  </Tooltip>
                  <div className='config-view__detail-breadcrumb'>
                    {breadcrumbItems.map((item, index) => (
                      <span key={item.key} className='config-view__detail-breadcrumb-item'>
                        {index > 0 && (
                          <span className='config-view__detail-separator' aria-hidden='true'>
                            <span className='material-symbols-rounded'>chevron_right</span>
                          </span>
                        )}
                        <span
                          className={`config-view__detail-crumb ${
                            item.isCurrent === true
                              ? 'config-view__detail-crumb--current'
                              : 'config-view__detail-crumb--static'
                          }`}
                        >
                          {item.label}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            : null}
          {headerExtra != null && (
            <div className='config-view__section-header-extra'>
              {headerExtra}
            </div>
          )}
        </div>
      )}
      <div ref={scrollRef} className='config-view__card'>
        <SectionForm
          sectionKey={sectionKey}
          fields={resolvedFields}
          uiSection={uiSection}
          value={value}
          resolvedValue={resolvedValue}
          onChange={onChange}
          mergedModelServices={mergedModelServices}
          mergedAdapters={mergedAdapters}
          selectedModelService={selectedModelService}
          worktreeEnvironmentOptions={worktreeEnvironmentOptions}
          detailRoute={detailRoute}
          onOpenDetailRoute={handleOpenDetail}
          t={t}
        />
      </div>
    </div>
  )
}
