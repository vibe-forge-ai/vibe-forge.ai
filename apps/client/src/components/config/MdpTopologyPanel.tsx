import './MdpTopologyPanel.scss'
import '../workspace/project-file-tree/ProjectFileTree.scss'

import { Button, Empty, Table, Tag, Tooltip, Typography } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'

import type { MdpClientSummary, MdpPathSummary, MdpSummaryResponse } from '@vibe-forge/types'

import { getMdpSummary } from '#~/api/mdp'
import { ProjectFileTreeRows } from '#~/components/workspace/project-file-tree/ProjectFileTreeRows'
import type {
  ProjectFileTreeNode,
  ProjectFileTreeSelectionAdjacency
} from '#~/components/workspace/project-file-tree/project-file-tree-types'

import type { TranslationFn } from './configUtils'

const { Text } = Typography

type MdpConnectionRow = MdpSummaryResponse['connections'][number]
type MdpClientRow = MdpClientSummary & { paths: MdpPathSummary[] }

const getClientMetadata = (client: Pick<MdpClientSummary, 'metadata'>) => (
  client.metadata != null &&
  typeof client.metadata === 'object' &&
  !Array.isArray(client.metadata)
    ? client.metadata
    : {}
)

const getBrowserCurrentPath = (client: Pick<MdpClientSummary, 'metadata'>) => {
  const metadata = getClientMetadata(client)
  const route = typeof metadata.currentRoute === 'string' ? metadata.currentRoute : ''
  const search = typeof metadata.currentSearch === 'string' ? metadata.currentSearch : ''
  const normalized = `${route}${search}`.trim()
  return normalized === '' ? null : normalized
}

const sortTreeNodes = (nodes: ProjectFileTreeNode[]): ProjectFileTreeNode[] => (
  [...nodes]
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'directory' ? -1 : 1
      }
      return left.name.localeCompare(right.name)
    })
    .map((node) => ({
      ...node,
      ...(node.children != null ? { children: sortTreeNodes(node.children) } : {})
    }))
)

const buildMdpPathTree = (paths: MdpPathSummary[]): ProjectFileTreeNode[] => {
  const root: ProjectFileTreeNode[] = []
  const directoryLookup = new Map<string, ProjectFileTreeNode>()
  const filePathSet = new Set<string>()

  for (const pathRecord of paths) {
    const normalizedPath = pathRecord.path.trim()
    if (normalizedPath === '' || normalizedPath === '/') {
      continue
    }
    if (filePathSet.has(normalizedPath)) {
      continue
    }
    filePathSet.add(normalizedPath)

    const segments = normalizedPath.split('/').filter(Boolean)
    if (segments.length === 0) {
      continue
    }

    let currentChildren = root
    let currentPath = ''

    for (const [index, segment] of segments.entries()) {
      currentPath = `${currentPath}/${segment}`
      const isLeaf = index === segments.length - 1

      if (isLeaf) {
        currentChildren.push({
          name: segment,
          path: currentPath,
          type: 'file'
        })
        continue
      }

      let directory = directoryLookup.get(currentPath)
      if (directory == null) {
        directory = {
          name: segment,
          path: currentPath,
          type: 'directory',
          children: []
        }
        directoryLookup.set(currentPath, directory)
        currentChildren.push(directory)
      }

      currentChildren = directory.children ?? []
    }
  }

  return sortTreeNodes(root)
}

function MdpPathTree({
  paths
}: {
  paths: MdpPathSummary[]
}) {
  const treeNodes = useMemo(() => buildMdpPathTree(paths), [paths])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setExpandedPaths(new Set())
  }, [treeNodes])

  const emptySelectionSet = useMemo(() => new Set<string>(), [])
  const emptySelectionAdjacency = useMemo(() => new Map<string, ProjectFileTreeSelectionAdjacency>(), [])
  const loadingPaths = useMemo(() => new Set<string>(), [])

  return (
    <div className='project-file-tree mdp-topology__path-tree'>
      <ProjectFileTreeRows
        depth={0}
        expandedPaths={expandedPaths}
        loadingPaths={loadingPaths}
        nodes={treeNodes}
        referenceNodes={[]}
        selectableTypes='all'
        selectedAdjacencyByPath={emptySelectionAdjacency}
        selectedPathSet={emptySelectionSet}
        showContextMenu={false}
        onContextSelect={() => {}}
        onSelectNode={() => false}
        onToggleDirectory={(node) => {
          setExpandedPaths((current) => {
            const next = new Set(current)
            if (next.has(node.path)) {
              next.delete(node.path)
            } else {
              next.add(node.path)
            }
            return next
          })
        }}
      />
    </div>
  )
}

export function MdpTopologyPanel({
  t
}: {
  t: TranslationFn
}) {
  const { data, error, isLoading, mutate } = useSWR<MdpSummaryResponse>(
    '/api/mdp/summary',
    getMdpSummary,
    {
      refreshInterval: 5000
    }
  )
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [revealedClientIds, setRevealedClientIds] = useState<Record<string, boolean>>({})
  const openClientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const formatTimestamp = useMemo(() => new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'medium'
  }), [])

  const clientRows = useMemo<MdpClientRow[]>(() => {
    if (data == null) {
      return []
    }

    const pathLookup = new Map<string, MdpPathSummary[]>()
    for (const path of data.paths) {
      const paths = pathLookup.get(path.clientId)
      if (paths == null) {
        pathLookup.set(path.clientId, [path])
        continue
      }
      paths.push(path)
    }

    return data.clients
      .map((client: MdpClientSummary) => ({
        ...client,
        paths: pathLookup.get(client.clientId) ?? []
      }))
      .sort((left, right) => {
        const leftCreated = left.connectedAt == null ? 0 : Date.parse(left.connectedAt)
        const rightCreated = right.connectedAt == null ? 0 : Date.parse(right.connectedAt)
        if (leftCreated !== rightCreated) {
          return rightCreated - leftCreated
        }
        return left.name.localeCompare(right.name)
      })
  }, [data])

  const selectedClient = useMemo(
    () => clientRows.find(client => client.clientId === selectedClientId) ?? null,
    [clientRows, selectedClientId]
  )

  const connectionLabelByKey = useMemo(() => {
    const entries = (data?.connections ?? []).map((connection) => {
      const title = connection.title?.trim()
      if (title != null && title !== '') {
        return [connection.key, title] as const
      }
      if (connection.key === 'default') {
        return [connection.key, t('config.mdpTopology.defaultConnection')] as const
      }
      return [connection.key, connection.key] as const
    })
    return new Map(entries)
  }, [data?.connections, t])

  useEffect(() => {
    if (selectedClientId == null) return
    if (selectedClient != null) return
    setSelectedClientId(null)
  }, [selectedClient, selectedClientId])

  useEffect(() => () => {
    if (openClientTimerRef.current != null) {
      clearTimeout(openClientTimerRef.current)
      openClientTimerRef.current = null
    }
  }, [])

  const handleClientClick = (clientId: string) => {
    if (openClientTimerRef.current != null) {
      clearTimeout(openClientTimerRef.current)
    }
    openClientTimerRef.current = setTimeout(() => {
      setSelectedClientId(clientId)
      openClientTimerRef.current = null
    }, 220)
  }

  const handleClientDoubleClick = (clientId: string) => {
    if (openClientTimerRef.current != null) {
      clearTimeout(openClientTimerRef.current)
      openClientTimerRef.current = null
    }
    setRevealedClientIds((current) => ({
      ...current,
      [clientId]: !current[clientId]
    }))
  }

  const headerExtra = (
    <div className='mdp-topology__header-extra'>
      <Tooltip title={t('config.mdpTopology.refresh')}>
        <Button
          size='small'
          type='text'
          className='mdp-topology__header-button'
          aria-label={t('config.mdpTopology.refresh')}
          icon={<span className='material-symbols-rounded'>refresh</span>}
          onClick={() => void mutate()}
        />
      </Tooltip>
    </div>
  )

  const selectedBrowserPath = selectedClient == null ? null : getBrowserCurrentPath(selectedClient)
  const detailSummary = selectedClient == null
    ? null
    : (
      <div className='mdp-topology__detail-summary'>
        <div className='mdp-topology__detail-field'>
          <Text type='secondary' className='mdp-topology__detail-label'>
            {t('config.mdpTopology.clientName')}
          </Text>
          <Text className='mdp-topology__detail-value'>{selectedClient.name}</Text>
        </div>
        {selectedBrowserPath != null && (
          <div className='mdp-topology__detail-field'>
            <Text type='secondary' className='mdp-topology__detail-label'>
              {t('config.mdpTopology.browserPath')}
            </Text>
            <Text className='mdp-topology__detail-value mdp-topology__detail-value--break'>
              {selectedBrowserPath}
            </Text>
          </div>
        )}
        <div className='mdp-topology__detail-field'>
          <Text type='secondary' className='mdp-topology__detail-label'>
            {t('config.mdpTopology.connection')}
          </Text>
          <Text className='mdp-topology__detail-value'>
            {connectionLabelByKey.get(selectedClient.connectionKey) ?? selectedClient.connectionKey}
          </Text>
        </div>
        <div className='mdp-topology__detail-field'>
          <Text type='secondary' className='mdp-topology__detail-label'>
            {t('config.mdpTopology.createdAt')}
          </Text>
          <Text className='mdp-topology__detail-value'>
            {selectedClient.connectedAt != null
              ? formatTimestamp.format(new Date(selectedClient.connectedAt))
              : '-'}
          </Text>
        </div>
      </div>
    )

  return (
    <div className='config-view__editor-wrap mdp-topology'>
      <div className='config-view__section-header'>
        {selectedClient == null
          ? (
            <div className='config-view__section-title'>
              <span className='material-symbols-rounded config-view__section-icon'>hub</span>
              <span>{t('config.mdpTopology.title')}</span>
            </div>
          )
          : (
            <div className='config-view__detail-trail'>
              <Tooltip title={t('config.detail.back')}>
                <Button
                  size='small'
                  type='text'
                  className='config-view__detail-back'
                  aria-label={t('config.detail.back')}
                  icon={<span className='material-symbols-rounded'>chevron_left</span>}
                  onClick={() => setSelectedClientId(null)}
                />
              </Tooltip>
              <div className='config-view__detail-breadcrumb'>
                <span className='config-view__detail-crumb config-view__detail-crumb--static'>
                  {t('config.mdpTopology.title')}
                </span>
                <span className='config-view__detail-separator'>/</span>
                <span className='config-view__detail-crumb config-view__detail-crumb--current'>
                  {selectedClient.name}
                </span>
              </div>
            </div>
          )}
        <div className='config-view__section-header-extra'>
          {headerExtra}
        </div>
      </div>

      <div className='config-view__card mdp-topology__body'>
        {isLoading && <Text type='secondary'>{t('config.mdpTopology.loading')}</Text>}
        {!isLoading && error != null && (
          <Text type='danger'>{t('config.mdpTopology.loadFailed')}</Text>
        )}
        {!isLoading && error == null && data != null && !data.enabled && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('config.mdpTopology.disabled')}
          />
        )}
        {!isLoading && error == null && data != null && data.enabled && selectedClient == null && (
          <>
            <Table<MdpConnectionRow>
              className='mdp-topology__table'
              size='small'
              rowKey='key'
              pagination={false}
              dataSource={data.connections}
              columns={[
                {
                  title: t('config.mdpTopology.connection'),
                  key: 'key',
                  render: (_, record) => connectionLabelByKey.get(record.key) ?? record.key
                },
                {
                  title: t('config.mdpTopology.status'),
                  key: 'ok',
                  render: (_, record) => record.ok
                    ? <Tag color='success'>{t('config.mdpTopology.connected')}</Tag>
                    : <Tag color='error'>{t('config.mdpTopology.failed')}</Tag>
                },
                {
                  title: t('config.mdpTopology.host'),
                  key: 'selectedHost',
                  render: (_, record) => record.selectedHost ?? record.hosts[0] ?? '-'
                },
                {
                  title: t('config.mdpTopology.error'),
                  key: 'error',
                  render: (_, record) => record.error ?? '-'
                }
              ]}
            />

            <Table<MdpClientRow>
              className='mdp-topology__table'
              size='small'
              rowKey='clientId'
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              dataSource={clientRows}
              onRow={(record) => ({
                className: 'mdp-topology__client-row',
                onClick: () => handleClientClick(record.clientId)
              })}
              columns={[
                {
                  title: t('config.mdpTopology.clientName'),
                  key: 'name',
                  render: (_, record) => {
                    const browserPath = getBrowserCurrentPath(record)
                    return (
                      <div className='mdp-topology__client-cell'>
                      <Tooltip title={t('config.mdpTopology.revealClientId')}>
                        <div
                          className='mdp-topology__client-name mdp-topology__client-name--interactive'
                          onDoubleClick={(event) => {
                            event.stopPropagation()
                            handleClientDoubleClick(record.clientId)
                          }}
                        >
                          <span className='mdp-topology__client-name-text'>{record.name}</span>
                        </div>
                      </Tooltip>
                      {browserPath != null && (
                        <Text type='secondary' className='mdp-topology__client-route'>
                          {browserPath}
                        </Text>
                      )}
                      {revealedClientIds[record.clientId] && (
                        <Text type='secondary' className='mdp-topology__client-meta'>
                          {t('config.mdpTopology.clientIdLabel', { id: record.rawClientId })}
                        </Text>
                      )}
                    </div>
                    )
                  }
                },
                {
                  title: t('config.mdpTopology.connection'),
                  key: 'connectionKey',
                  render: (_, record) => connectionLabelByKey.get(record.connectionKey) ?? record.connectionKey
                },
                {
                  title: t('config.mdpTopology.createdAt'),
                  key: 'connectedAt',
                  render: (_, record) => (
                    record.connectedAt != null
                      ? formatTimestamp.format(new Date(record.connectedAt))
                      : '-'
                  )
                }
              ]}
            />
          </>
        )}
        {!isLoading && error == null && data != null && data.enabled && selectedClient != null && (
          selectedClient.paths.length === 0
            ? (
              <div className='mdp-topology__detail-body'>
                {detailSummary}
                <div className='mdp-topology__detail-empty'>
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t('common.noData')}
                  />
                </div>
              </div>
            )
            : (
              <div className='mdp-topology__detail-body'>
                {detailSummary}
                <MdpPathTree paths={selectedClient.paths} />
              </div>
            )
        )}
      </div>
    </div>
  )
}
