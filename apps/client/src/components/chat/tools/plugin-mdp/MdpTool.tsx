import './MdpTool.scss'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CodeBlock } from '#~/components/CodeBlock'
import { safeJsonStringify } from '#~/utils/safe-serialize'
import { ToolCallBox } from '../core/ToolCallBox'
import { ToolResultContent } from '../core/ToolResultContent'
import { ToolSummaryHeader } from '../core/ToolSummaryHeader'
import { ToolInlineFields, renderToolBlockField } from '../core/tool-field-sections'
import { defineToolRender } from '../defineToolRender'
import {
  buildMdpRequestFields,
  extractMdpToolPayload,
  getMdpCallStatus,
  getMdpClientRoute,
  getMdpToolTarget,
  resolveMdpToolKind,
  type MdpToolKind
} from './mdp-tool-utils'

const MAX_VISIBLE_CLIENTS = 8
const MAX_VISIBLE_PATHS = 18
const MAX_VISIBLE_BATCH_RESULTS = 8

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const asString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const buildMdpTitle = (kind: MdpToolKind, t: (key: string, options?: Record<string, unknown>) => string) => {
  switch (kind) {
    case 'listClients':
      return t('chat.tools.mdp.listClients', { defaultValue: 'Clients' })
    case 'listPaths':
      return t('chat.tools.mdp.listPaths', { defaultValue: 'Paths' })
    case 'callPath':
      return t('chat.tools.mdp.callPath', { defaultValue: 'Call' })
    case 'callPaths':
      return t('chat.tools.mdp.callPaths', { defaultValue: 'Batch Call' })
  }
}

const buildMetaNode = (params: {
  kind: MdpToolKind
  payload: unknown
  isError: boolean
  t: (key: string, options?: Record<string, unknown>) => string
}) => {
  if (params.isError) {
    return (
      <span className='tool-status tool-status--error'>
        <span className='material-symbols-rounded'>error</span>
      </span>
    )
  }

  if (params.kind === 'listClients' && isRecord(params.payload) && Array.isArray(params.payload.clients)) {
    return <span className='mdp-tool__meta-count'>{params.payload.clients.length}</span>
  }

  if (params.kind === 'listPaths' && isRecord(params.payload) && Array.isArray(params.payload.paths)) {
    return <span className='mdp-tool__meta-count'>{params.payload.paths.length}</span>
  }

  if (params.kind === 'callPaths' && isRecord(params.payload) && Array.isArray(params.payload.results)) {
    return <span className='mdp-tool__meta-count'>{params.payload.results.length}</span>
  }

  const callStatus = getMdpCallStatus(params.payload)
  if (callStatus == null) {
    return undefined
  }

  return (
    <span className={`mdp-tool__meta-status ${callStatus ? 'is-ok' : 'is-error'}`}>
      {callStatus
        ? params.t('chat.tools.mdp.ok', { defaultValue: 'OK' })
        : params.t('chat.tools.mdp.failed', { defaultValue: 'Failed' })}
    </span>
  )
}

const renderEmptyState = (text: string) => (
  <div className='mdp-tool__empty'>{text}</div>
)

const renderRequestLineFields = (
  fields: Array<{ labelKey: string, fallbackLabel: string, value: unknown }>,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  if (fields.length === 0) {
    return null
  }

  return (
    <div className='mdp-tool__request-lines'>
      {fields.map((field, index) => (
        <div className='mdp-tool__request-line' key={`${field.labelKey}-${index}`}>
          <span className='mdp-tool__request-line-label'>
            {t(field.labelKey, { defaultValue: field.fallbackLabel })}
          </span>
          <span className='mdp-tool__request-line-value'>{String(field.value)}</span>
        </div>
      ))}
    </div>
  )
}

const renderClientResults = (
  payload: unknown,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  if (!isRecord(payload) || !Array.isArray(payload.clients)) {
    return null
  }

  const clients = payload.clients.filter(isRecord)
  if (clients.length === 0) {
    return renderEmptyState(t('chat.tools.mdp.emptyClients', { defaultValue: 'No clients returned.' }))
  }

  const visibleClients = clients.slice(0, MAX_VISIBLE_CLIENTS)
  const hiddenCount = clients.length - visibleClients.length

  return (
    <div className='mdp-tool__client-list'>
      {visibleClients.map((client) => {
        const name = asString(client.name) || t('chat.tools.unknown', { defaultValue: 'Unknown tool' })
        const route = getMdpClientRoute(client.metadata)
        const description = asString(client.description)
        const clientId = asString(client.clientId)

        return (
          <div className='mdp-tool__client-card' key={clientId || name}>
            <div className='mdp-tool__client-card-header'>
              <span className='mdp-tool__client-name'>{name}</span>
              {route != null && route !== '' && (
                <span className='mdp-tool__client-route'>{route}</span>
              )}
            </div>
            <div className='mdp-tool__client-meta-row'>
              {clientId !== '' && <code className='mdp-tool__client-id'>{clientId}</code>}
              {description !== '' && <span className='mdp-tool__client-description'>{description}</span>}
            </div>
          </div>
        )
      })}
      {hiddenCount > 0 && (
        <div className='mdp-tool__overflow-note'>
          {t('chat.tools.mdp.moreClients', {
            count: hiddenCount,
            defaultValue: `+${hiddenCount} more clients`
          })}
        </div>
      )}
    </div>
  )
}

const renderPathResults = (
  payload: unknown,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  if (!isRecord(payload) || !Array.isArray(payload.paths)) {
    return null
  }

  const paths = payload.paths.filter(isRecord)
  if (paths.length === 0) {
    return renderEmptyState(t('chat.tools.mdp.emptyPaths', { defaultValue: 'No paths returned.' }))
  }

  const visiblePaths = paths.slice(0, MAX_VISIBLE_PATHS)
  const hiddenCount = paths.length - visiblePaths.length

  return (
    <div className='mdp-tool__path-list'>
      {visiblePaths.map((pathRecord, index) => {
        const path = asString(pathRecord.path) || '/'
        const type = asString(pathRecord.type)
        const description = asString(pathRecord.description)
        const methods = Array.isArray(pathRecord.methods)
          ? pathRecord.methods.map(asString).filter(value => value !== '')
          : []

        return (
          <div className='mdp-tool__path-row' key={`${path}-${index}`}>
            <div className='mdp-tool__path-main'>
              <code className='mdp-tool__path-value'>{path}</code>
              <div className='mdp-tool__path-badges'>
                {type !== '' && <span className='mdp-tool__badge'>{type}</span>}
                {methods.map(method => (
                  <span className='mdp-tool__badge mdp-tool__badge--method' key={method}>{method}</span>
                ))}
              </div>
            </div>
            {description !== '' && (
              <div className='mdp-tool__path-description'>{description}</div>
            )}
          </div>
        )
      })}
      {hiddenCount > 0 && (
        <div className='mdp-tool__overflow-note'>
          {t('chat.tools.mdp.morePaths', {
            count: hiddenCount,
            defaultValue: `+${hiddenCount} more paths`
          })}
        </div>
      )}
    </div>
  )
}

const renderCallPathResult = (
  payload: unknown,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  if (!isRecord(payload)) {
    return <ToolResultContent content={payload} />
  }

  const errorMessage = isRecord(payload.error) ? asString(payload.error.message) : ''
  if (errorMessage !== '') {
    return (
      <div className='mdp-tool__call-result mdp-tool__call-result--error'>
        <div className='mdp-tool__call-status'>{t('chat.tools.mdp.failed', { defaultValue: 'Failed' })}</div>
        <div className='mdp-tool__call-message'>{errorMessage}</div>
      </div>
    )
  }

  const data = 'data' in payload ? payload.data : payload
  if (isRecord(data)) {
    if (isRecord(data.session)) {
      const session = data.session
      const preferredKeys = ['id', 'title', 'status', 'messageCount', 'adapter', 'createdAt']
      const primitiveEntries = preferredKeys
        .filter(key => typeof session[key] === 'string' || typeof session[key] === 'number' || typeof session[key] === 'boolean')
        .map(key => [key, session[key]] as const)

      if (primitiveEntries.length > 0) {
        return (
          <div className='mdp-tool__call-result'>
            {primitiveEntries.map(([key, value]) => (
              <div className='mdp-tool__kv-row' key={key}>
                <span className='mdp-tool__kv-label'>{key}</span>
                <span className='mdp-tool__kv-value'>{String(value)}</span>
              </div>
            ))}
          </div>
        )
      }
    }

    const primitiveEntries = Object.entries(data).filter(([, value]) => (
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ))

    if (primitiveEntries.length > 0 && primitiveEntries.length <= 6) {
      return (
        <div className='mdp-tool__call-result'>
          {primitiveEntries.map(([key, value]) => (
            <div className='mdp-tool__kv-row' key={key}>
              <span className='mdp-tool__kv-label'>{key}</span>
              <span className='mdp-tool__kv-value'>{String(value)}</span>
            </div>
          ))}
        </div>
      )
    }
  }

  return <ToolResultContent content={data} />
}

const renderCallPathsResult = (
  payload: unknown,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    return <ToolResultContent content={payload} />
  }

  const results = payload.results.filter(isRecord)
  if (results.length === 0) {
    return renderEmptyState(t('chat.tools.mdp.emptyResults', { defaultValue: 'No results returned.' }))
  }

  const visibleResults = results.slice(0, MAX_VISIBLE_BATCH_RESULTS)
  const hiddenCount = results.length - visibleResults.length

  return (
    <div className='mdp-tool__batch-list'>
      {visibleResults.map((result, index) => {
        const clientId = asString(result.clientId)
        const errorMessage = isRecord(result.error) ? asString(result.error.message) : ''
        const status = result.ok === false ? 'error' : 'ok'

        return (
          <div className='mdp-tool__batch-card' key={`${clientId}-${index}`}>
            <div className='mdp-tool__batch-card-header'>
              <code className='mdp-tool__client-id'>{clientId}</code>
              <span className={`mdp-tool__meta-status ${status === 'ok' ? 'is-ok' : 'is-error'}`}>
                {status === 'ok'
                  ? t('chat.tools.mdp.ok', { defaultValue: 'OK' })
                  : t('chat.tools.mdp.failed', { defaultValue: 'Failed' })}
              </span>
            </div>
            {errorMessage !== '' && (
              <div className='mdp-tool__call-message'>{errorMessage}</div>
            )}
          </div>
        )
      })}
      {hiddenCount > 0 && (
        <div className='mdp-tool__overflow-note'>
          {t('chat.tools.mdp.moreResults', {
            count: hiddenCount,
            defaultValue: `+${hiddenCount} more results`
          })}
        </div>
      )}
    </div>
  )
}

export const MdpTool = defineToolRender(({ item, resultItem }) => {
  const { t } = useTranslation()
  const kind = resolveMdpToolKind(item.name)
  const [expandedHiddenDetails, setExpandedHiddenDetails] = useState<Record<string, boolean>>({})

  if (kind == null) {
    return null
  }

  const payload = extractMdpToolPayload(resultItem?.content)
  const requestFields = useMemo(() => buildMdpRequestFields(item.input), [item.input])
  const hasCallDetails = requestFields.inlineFields.length > 0 ||
    requestFields.lineFields.length > 0 ||
    requestFields.blockFields.length > 0 ||
    requestFields.hiddenBlockFields.length > 0
  const hasResultDetails = resultItem != null
  const hasDetails = hasCallDetails || hasResultDetails
  const title = buildMdpTitle(kind, t)
  const target = getMdpToolTarget(kind, item.input)
  const meta = buildMetaNode({
    kind,
    payload,
    isError: resultItem?.is_error === true,
    t
  })

  const resultSection = (() => {
    switch (kind) {
      case 'listClients':
        return renderClientResults(payload, t)
      case 'listPaths':
        return renderPathResults(payload, t)
      case 'callPath':
        return renderCallPathResult(payload, t)
      case 'callPaths':
        return renderCallPathsResult(payload, t)
    }
  })()

  return (
    <div className='tool-group tool-group--compact mdp-tool'>
      <ToolCallBox
        key={hasDetails ? 'details' : 'summary'}
        variant='inline'
        defaultExpanded={false}
        collapsible={hasDetails}
        header={({ isExpanded, isCollapsible }) => (
          <ToolSummaryHeader
            icon={<span className='material-symbols-rounded'>device_hub</span>}
            title={title}
            target={target}
            targetTitle={target}
            targetMonospace={kind !== 'listClients'}
            expanded={isExpanded}
            collapsible={isCollapsible}
            meta={meta}
            metaTitle={meta == null ? undefined : t('chat.result', { defaultValue: 'Result' })}
          />
        )}
        content={hasDetails
          ? (
            <div className='tool-detail-sections mdp-tool__details'>
              {hasCallDetails && (
                <>
                  <ToolInlineFields fields={requestFields.inlineFields} t={t} />
                  {renderRequestLineFields(requestFields.lineFields, t)}
                  {requestFields.blockFields.map((field, index) => renderToolBlockField(field, index, t, {
                    hideHeader: true
                  }))}
                  {requestFields.hiddenBlockFields.map((field, index) => {
                    const hiddenFieldKey = `${field.labelKey}-hidden-${index}`
                    const isExpanded = expandedHiddenDetails[hiddenFieldKey] === true

                    return (
                      <div className='mdp-tool__hidden-detail' key={hiddenFieldKey}>
                        <button
                          type='button'
                          className='mdp-tool__hidden-detail-summary'
                          aria-expanded={isExpanded}
                          onClick={() => {
                            setExpandedHiddenDetails((current) => ({
                              ...current,
                              [hiddenFieldKey]: !current[hiddenFieldKey]
                            }))
                          }}
                        >
                          <span className='mdp-tool__hidden-detail-label'>
                            {t(field.labelKey, { defaultValue: field.fallbackLabel })}
                          </span>
                          <span className={`material-symbols-rounded mdp-tool__hidden-detail-toggle ${isExpanded ? 'is-expanded' : ''}`}>
                            expand_more
                          </span>
                        </button>
                        <div
                          className={`mdp-tool__hidden-detail-body-shell ${isExpanded ? 'expanded' : 'collapsed'}`}
                          aria-hidden={!isExpanded}
                        >
                          <div className='mdp-tool__hidden-detail-body'>
                            {renderToolBlockField(field, index, t, {
                              hideHeader: true,
                              sectionClassName: 'tool-detail-section mdp-tool__hidden-detail-content'
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
              {hasResultDetails && (
                <div className='tool-detail-section mdp-tool__result-section'>
                  {resultSection ?? (
                    <CodeBlock
                      code={safeJsonStringify(payload, 2)}
                      lang='json'
                      hideHeader={true}
                    />
                  )}
                </div>
              )}
            </div>
          )
          : null}
      />
    </div>
  )
})
