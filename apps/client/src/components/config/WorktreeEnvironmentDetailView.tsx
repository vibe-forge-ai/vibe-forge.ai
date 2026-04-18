import { Button, Input, Spin, Tooltip } from 'antd'
import type { ReactNode } from 'react'

import type { WorktreeEnvironmentDetail, WorktreeEnvironmentScriptKey } from '@vibe-forge/types'

import { WorktreeEnvironmentScriptEditors } from './WorktreeEnvironmentScriptEditors'
import type { TranslationFn } from './configUtils'
import { toDisplayEnvironmentName } from './worktree-environment-panel-model'

export function WorktreeEnvironmentDetailView({
  draftScripts,
  isDetailLoading,
  nameDraft,
  selectedEnvironment,
  sourceSwitch,
  onBack,
  onNameDraftChange,
  onScriptChange,
  t
}: {
  draftScripts: Record<WorktreeEnvironmentScriptKey, string>
  isDetailLoading: boolean
  nameDraft: string
  selectedEnvironment?: WorktreeEnvironmentDetail
  sourceSwitch: ReactNode
  onBack: () => void
  onNameDraftChange: (value: string) => void
  onScriptChange: (key: WorktreeEnvironmentScriptKey, content: string) => void
  t: TranslationFn
}) {
  if (selectedEnvironment == null) {
    return (
      <div className='worktree-env-panel__state'>
        <Spin />
      </div>
    )
  }

  return (
    <div className='worktree-env-panel__detail-view'>
      <div className='config-view__section-header worktree-env-panel__detail-header'>
        <WorktreeEnvironmentBreadcrumb
          environmentId={selectedEnvironment.id}
          isLocal={selectedEnvironment.isLocal}
          onBack={onBack}
          t={t}
        />
        <div className='config-view__section-header-extra'>
          {sourceSwitch}
        </div>
      </div>

      <section className='worktree-env-panel__section'>
        <div className='worktree-env-panel__field-row'>
          <label>{t('config.environments.name')}</label>
          <Input
            value={nameDraft}
            onChange={event => onNameDraftChange(event.target.value)}
          />
        </div>
      </section>

      {isDetailLoading
        ? (
          <div className='worktree-env-panel__state'>
            <Spin />
          </div>
        )
        : (
          <WorktreeEnvironmentScriptEditors
            draftScripts={draftScripts}
            onChange={onScriptChange}
            t={t}
          />
        )}
    </div>
  )
}

function WorktreeEnvironmentBreadcrumb({
  environmentId,
  isLocal,
  onBack,
  t
}: {
  environmentId: string
  isLocal: boolean
  onBack: () => void
  t: TranslationFn
}) {
  const listTitle = isLocal
    ? t('config.environments.localListTitle')
    : t('config.environments.projectListTitle')

  return (
    <div className='config-view__detail-trail'>
      <Tooltip title={t('config.detail.back')}>
        <Button
          size='small'
          type='text'
          className='config-view__detail-back'
          aria-label={t('config.detail.back')}
          icon={<span className='material-symbols-rounded'>chevron_left</span>}
          onClick={onBack}
        />
      </Tooltip>
      <div className='config-view__detail-breadcrumb'>
        <span className='config-view__detail-crumb config-view__detail-crumb--static'>
          {t('config.sections.environments')}
        </span>
        <span className='config-view__detail-separator'>/</span>
        <button
          type='button'
          className='config-view__detail-crumb config-view__detail-crumb--link'
          onClick={onBack}
        >
          {listTitle}
        </button>
        <span className='config-view__detail-separator'>/</span>
        <span className='config-view__detail-crumb config-view__detail-crumb--current'>
          {toDisplayEnvironmentName(environmentId)}
        </span>
      </div>
    </div>
  )
}
