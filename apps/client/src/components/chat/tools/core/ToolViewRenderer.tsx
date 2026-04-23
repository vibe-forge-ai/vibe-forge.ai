import React, { useMemo } from 'react'
import { Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

import type { ToolView, ToolViewArtifact, ToolViewEnvelope, ToolViewField } from '@vibe-forge/types'

import { CodeBlock } from '#~/components/CodeBlock'
import { safeJsonStringify } from '#~/utils/safe-serialize'

import { ToolCallBox } from './ToolCallBox'
import { ToolSummaryHeader } from './ToolSummaryHeader'
import { TOOL_TOOLTIP_PROPS, getToolFieldIcon, getToolTargetPresentation } from './tool-display'
import { ToolViewArtifactRenderer } from './tool-view-artifact-renderers'

const getFieldKey = (field: ToolViewField, index: number) => `${field.label}-${index}`

const getStatusMeta = (status: ToolViewEnvelope['summary']['status']) => {
  if (status === 'error') {
    return {
      icon: 'error',
      title: 'Error'
    }
  }

  if (status === 'running') {
    return {
      icon: 'sync',
      title: 'Running'
    }
  }

  if (status === 'success') {
    return {
      icon: 'check_circle',
      title: 'Success'
    }
  }

  return undefined
}

const findArtifact = (artifacts: ToolViewArtifact[] | undefined, artifactId: string) => (
  artifacts?.find(item => item.id === artifactId)
)

const renderInlineFields = (fields: ToolViewField[]) => {
  const inlineFields = fields.filter(field => (field.format ?? 'inline') === 'inline')
  if (inlineFields.length === 0) {
    return null
  }

  return (
    <div className='tool-inline-token-list tool-inline-token-list--standalone'>
      {inlineFields.map((field, index) => {
        const valueText = typeof field.value === 'string'
          ? field.value
          : typeof field.value === 'number' || typeof field.value === 'boolean'
          ? String(field.value)
          : safeJsonStringify(field.value, 2)
        return (
          <Tooltip
            key={getFieldKey(field, index)}
            title={
              <div className='tool-tooltip-content'>
                <div className='tool-tooltip-content__title'>{field.label}</div>
                <div className='tool-tooltip-content__value'>{valueText}</div>
              </div>
            }
            {...TOOL_TOOLTIP_PROPS}
          >
            <div className='tool-inline-token'>
              <span className='tool-inline-token__icon material-symbols-rounded'>
                {getToolFieldIcon(field.label, field.format ?? 'inline')}
              </span>
              <span className='tool-inline-token__value'>{valueText.replace(/\s+/g, ' ').trim()}</span>
            </div>
          </Tooltip>
        )
      })}
    </div>
  )
}

const renderBlockField = (field: ToolViewField, index: number) => {
  const format = field.format ?? 'text'
  const label = field.label

  const sectionHeader = (
    <div className='tool-detail-section__header'>
      <Tooltip title={label} {...TOOL_TOOLTIP_PROPS}>
        <span className='tool-detail-section__icon material-symbols-rounded'>
          {getToolFieldIcon(label, format)}
        </span>
      </Tooltip>
    </div>
  )

  if (format === 'text') {
    return (
      <div className='tool-detail-section' key={getFieldKey(field, index)}>
        {sectionHeader}
        <div className='tool-detail-section__text'>{String(field.value)}</div>
      </div>
    )
  }

  if (format === 'code') {
    return (
      <div className='tool-detail-section' key={getFieldKey(field, index)}>
        {sectionHeader}
        <CodeBlock code={String(field.value)} lang={field.language ?? 'text'} hideHeader={true} />
      </div>
    )
  }

  if (format === 'list' && Array.isArray(field.value)) {
    return (
      <div className='tool-detail-section' key={getFieldKey(field, index)}>
        {sectionHeader}
        <div className='tool-detail-list'>
          {field.value.map(item => (
            <div className='tool-detail-list-item' key={String(item)}>{String(item)}</div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='tool-detail-section' key={getFieldKey(field, index)}>
      {sectionHeader}
      <CodeBlock code={safeJsonStringify(field.value, 2)} lang='json' hideHeader={true} />
    </div>
  )
}

const renderToolView = (
  view: ToolView | undefined,
  artifacts: ToolViewArtifact[] | undefined,
  labels: {
    split: string
    inline: string
  }
) => {
  if (view == null) {
    return null
  }

  return (
    <>
      {view.sections.map((section, index) => {
        if (section.type === 'fields') {
          const inline = renderInlineFields(section.fields)
          const blockFields = section.fields.filter(field => (field.format ?? 'inline') !== 'inline')
          return (
            <React.Fragment key={`fields-${index}`}>
              {inline}
              {blockFields.map((field, fieldIndex) => renderBlockField(field, fieldIndex))}
            </React.Fragment>
          )
        }

        if (section.type === 'notice') {
          return (
            <div
              className={`tool-detail-section tool-detail-section--notice ${
                section.tone != null ? `tool-detail-section--${section.tone}` : ''
              }`}
              key={`notice-${index}`}
            >
              <div className='tool-detail-section__text'>{section.text}</div>
            </div>
          )
        }

        const artifact = findArtifact(artifacts, section.artifactId)
        if (artifact == null) {
          return null
        }

        return (
          <div className='tool-detail-section' key={`artifact-${section.artifactId}`}>
            <ToolViewArtifactRenderer
              artifact={artifact}
              display={section.display}
              splitLabel={labels.split}
              inlineLabel={labels.inline}
            />
          </div>
        )
      })}
    </>
  )
}

export function ToolViewRenderer({
  toolView
}: {
  toolView: ToolViewEnvelope
}) {
  const { t } = useTranslation()
  const statusMeta = getStatusMeta(toolView.summary.status)
  const targetPresentation = getToolTargetPresentation(toolView.summary.primary)
  const hasDetails = toolView.call != null || toolView.result != null || (toolView.summary.badges?.length ?? 0) > 0

  const badgeRow = useMemo(() => {
    if ((toolView.summary.badges?.length ?? 0) === 0) {
      return null
    }

    return (
      <div className='tool-inline-token-list tool-inline-token-list--standalone'>
        {toolView.summary.badges?.map(badge => (
          <div className='tool-inline-token' key={`${badge.label}-${badge.tone ?? 'default'}`}>
            <span className='tool-inline-token__value'>{badge.label}</span>
          </div>
        ))}
      </div>
    )
  }, [toolView.summary.badges])

  return (
    <div className='tool-group tool-group--compact'>
      <ToolCallBox
        variant='inline'
        defaultExpanded={false}
        collapsible={hasDetails}
        header={({ isExpanded, isCollapsible }) => (
          <ToolSummaryHeader
            icon={<span className='material-symbols-rounded'>{toolView.summary.icon ?? 'build'}</span>}
            title={toolView.summary.title}
            target={targetPresentation.text}
            targetTitle={targetPresentation.title}
            targetMonospace={targetPresentation.monospace}
            expanded={isExpanded}
            collapsible={isCollapsible}
            meta={statusMeta == null
              ? undefined
              : (
                <span className='tool-status'>
                  <span className={`material-symbols-rounded ${toolView.summary.status === 'running' ? 'spin' : ''}`}>
                    {statusMeta.icon}
                  </span>
                </span>
              )}
            metaTitle={statusMeta?.title}
          />
        )}
        content={hasDetails
          ? (
            <div className='tool-detail-sections'>
              {badgeRow}
              {renderToolView(toolView.call, toolView.artifacts, {
                split: t('chat.tools.diffSplit'),
                inline: t('chat.tools.diffInline')
              })}
              {renderToolView(toolView.result, toolView.artifacts, {
                split: t('chat.tools.diffSplit'),
                inline: t('chat.tools.diffInline')
              })}
            </div>
          )
          : null}
      />
    </div>
  )
}
