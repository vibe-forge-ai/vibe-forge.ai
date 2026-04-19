import { Button, Empty, Input, Spin } from 'antd'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

import type { WorktreeEnvironmentSummary } from '@vibe-forge/types'

import type { TranslationFn } from './configUtils'
import { toDisplayEnvironmentName } from './worktree-environment-panel-model'

export function WorktreeEnvironmentListView({
  isLoading,
  sourceSwitch,
  visibleEnvironments,
  onCreate,
  onSelectEnvironment,
  t
}: {
  isLoading: boolean
  sourceSwitch: ReactNode
  visibleEnvironments: WorktreeEnvironmentSummary[]
  onCreate: () => void
  onSelectEnvironment: (id: string) => void
  t: TranslationFn
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const filteredEnvironments = useMemo(() => (
    normalizedSearchQuery === ''
      ? visibleEnvironments
      : visibleEnvironments.filter((environment) => {
        const displayName = toDisplayEnvironmentName(environment.id).toLowerCase()
        return displayName.includes(normalizedSearchQuery) ||
          environment.path.toLowerCase().includes(normalizedSearchQuery)
      })
  ), [normalizedSearchQuery, visibleEnvironments])

  return (
    <div className='worktree-env-panel__list-view'>
      <div className='worktree-env-panel__topbar'>
        <div className='config-view__section-title'>
          <span className='material-symbols-rounded config-view__section-icon'>deployed_code</span>
          <span>{t('config.sections.environments')}</span>
        </div>
        {sourceSwitch}
      </div>
      <section className='worktree-env-panel__section'>
        <div className='worktree-env-panel__search-row'>
          <Input
            allowClear
            value={searchQuery}
            className='worktree-env-panel__search'
            onChange={event => setSearchQuery(event.target.value)}
            placeholder={t('config.environments.searchPlaceholder')}
            prefix={<span className='material-symbols-rounded'>search</span>}
          />
          <Button
            type='text'
            className='worktree-env-panel__create-button'
            aria-label={t('config.environments.create')}
            title={t('config.environments.create')}
            icon={<span className='material-symbols-rounded'>add</span>}
            onClick={onCreate}
          />
        </div>
        <WorktreeEnvironmentListState
          isLoading={isLoading}
          emptyDescription={visibleEnvironments.length === 0
            ? t('config.environments.empty')
            : t('config.environments.searchEmpty')}
          visibleEnvironments={filteredEnvironments}
          onSelectEnvironment={onSelectEnvironment}
        />
      </section>
    </div>
  )
}

function WorktreeEnvironmentListState({
  emptyDescription,
  isLoading,
  visibleEnvironments,
  onSelectEnvironment
}: {
  emptyDescription: string
  isLoading: boolean
  visibleEnvironments: WorktreeEnvironmentSummary[]
  onSelectEnvironment: (id: string) => void
}) {
  if (isLoading) {
    return (
      <div className='worktree-env-panel__state'>
        <Spin />
      </div>
    )
  }

  if (visibleEnvironments.length === 0) {
    return (
      <div className='worktree-env-panel__state'>
        <Empty description={emptyDescription} />
      </div>
    )
  }

  return (
    <div className='worktree-env-panel__env-list'>
      {visibleEnvironments.map(environment => (
        <button
          key={environment.id}
          type='button'
          className='worktree-env-panel__env-row'
          onClick={() => onSelectEnvironment(environment.id)}
        >
          <span className='material-symbols-rounded'>deployed_code</span>
          <span className='worktree-env-panel__env-row-main'>
            <span className='worktree-env-panel__env-row-title'>
              {toDisplayEnvironmentName(environment.id)}
            </span>
            <span className='worktree-env-panel__env-row-path'>{environment.path}</span>
          </span>
          <span className='material-symbols-rounded'>chevron_right</span>
        </button>
      ))}
    </div>
  )
}
