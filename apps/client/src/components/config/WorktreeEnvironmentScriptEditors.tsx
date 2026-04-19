import { useState } from 'react'

import type {
  WorktreeEnvironmentOperation,
  WorktreeEnvironmentPlatform,
  WorktreeEnvironmentScriptKey
} from '@vibe-forge/types'

import { WorktreeEnvironmentScriptEditorCard } from './WorktreeEnvironmentScriptEditorCard'
import type { TranslationFn } from './configUtils'
import { operationGroups } from './worktree-environment-panel-model'

type PlatformOverride = Exclude<WorktreeEnvironmentPlatform, 'base'>

const platformIcons: Record<PlatformOverride, string> = {
  linux: 'terminal',
  macos: 'laptop_mac',
  windows: 'desktop_windows'
}

const getScriptLabel = (key: WorktreeEnvironmentScriptKey, t: TranslationFn) => (
  t(`config.environments.scripts.${key}`)
)

const getOperationSectionTitle = (operation: WorktreeEnvironmentOperation, t: TranslationFn) => (
  t(`config.environments.operationSections.${operation}.title`)
)

const toggleSetValue = <T,>(current: Set<T>, value: T) => {
  const next = new Set(current)
  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }
  return next
}

export function WorktreeEnvironmentScriptEditors({
  draftScripts,
  onChange,
  t
}: {
  draftScripts: Record<WorktreeEnvironmentScriptKey, string>
  onChange: (key: WorktreeEnvironmentScriptKey, content: string) => void
  t: TranslationFn
}) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<WorktreeEnvironmentOperation, PlatformOverride>>({
    create: 'macos',
    destroy: 'macos',
    start: 'macos'
  })
  const [expandedOperations, setExpandedOperations] = useState<Set<WorktreeEnvironmentOperation>>(
    () => new Set(['create'])
  )
  const [expandedPlatformGroups, setExpandedPlatformGroups] = useState<Set<WorktreeEnvironmentOperation>>(
    () => new Set()
  )

  return (
    <div className='worktree-env-panel__script-sections'>
      {operationGroups.map((group) => {
        const selectedPlatform = selectedPlatforms[group.operation]
        const selectedScript = group.platformScripts.find(item => item.platform === selectedPlatform) ??
          group.platformScripts[0]
        const isOperationExpanded = expandedOperations.has(group.operation)
        const isPlatformGroupExpanded = expandedPlatformGroups.has(group.operation)
        const operationTitle = getOperationSectionTitle(group.operation, t)

        return (
          <section
            key={group.operation}
            className={`worktree-env-panel__script-section ${isOperationExpanded ? 'is-expanded' : 'is-collapsed'}`}
          >
            <button
              type='button'
              className='worktree-env-panel__fold-header'
              aria-expanded={isOperationExpanded}
              aria-label={`${
                isOperationExpanded ? t('config.editor.collapse') : t('config.editor.expand')
              } ${operationTitle}`}
              onClick={() => {
                setExpandedOperations(prev => toggleSetValue(prev, group.operation))
              }}
            >
              <span className='worktree-env-panel__fold-header-main'>
                <span className='worktree-env-panel__fold-title'>{operationTitle}</span>
              </span>
              <span
                className={`material-symbols-rounded worktree-env-panel__fold-chevron ${
                  isOperationExpanded ? 'is-active' : ''
                }`}
              >
                chevron_right
              </span>
            </button>

            {isOperationExpanded && (
              <div className='worktree-env-panel__fold-body'>
                <WorktreeEnvironmentScriptEditorCard
                  scriptKey={group.baseScript}
                  value={draftScripts[group.baseScript]}
                  title={t('config.environments.baseScript')}
                  description={t(`config.environments.baseScriptDescriptions.${group.operation}`)}
                  onChange={onChange}
                  t={t}
                />
                <div className='worktree-env-panel__platform-block'>
                  <div className='worktree-env-panel__platform-header'>
                    <button
                      type='button'
                      className='worktree-env-panel__platform-toggle'
                      aria-expanded={isPlatformGroupExpanded}
                      aria-label={`${
                        isPlatformGroupExpanded ? t('config.editor.collapse') : t('config.editor.expand')
                      } ${t('config.environments.platformOverrides')}`}
                      onClick={() => {
                        setExpandedPlatformGroups(prev => toggleSetValue(prev, group.operation))
                      }}
                    >
                      <span className='worktree-env-panel__platform-copy'>
                        <span className='worktree-env-panel__platform-title'>
                          {t('config.environments.platformOverrides')}
                        </span>
                      </span>
                    </button>
                    <div className='worktree-env-panel__platform-switch' role='tablist'>
                      {group.platformScripts.map(({ platform, script }) => (
                        <button
                          key={platform}
                          type='button'
                          role='tab'
                          aria-selected={selectedPlatform === platform}
                          className={[
                            'worktree-env-panel__platform-tab',
                            selectedPlatform === platform ? 'is-active' : '',
                            draftScripts[script].trim() !== '' ? 'has-content' : ''
                          ].filter(Boolean).join(' ')}
                          title={t(`config.environments.platforms.${platform}`)}
                          onClick={() => {
                            setSelectedPlatforms(prev => ({ ...prev, [group.operation]: platform }))
                            setExpandedPlatformGroups(prev => new Set(prev).add(group.operation))
                          }}
                        >
                          <span className='material-symbols-rounded'>{platformIcons[platform]}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type='button'
                      className='worktree-env-panel__platform-chevron-button'
                      aria-expanded={isPlatformGroupExpanded}
                      aria-label={`${
                        isPlatformGroupExpanded ? t('config.editor.collapse') : t('config.editor.expand')
                      } ${t('config.environments.platformOverrides')}`}
                      onClick={() => {
                        setExpandedPlatformGroups(prev => toggleSetValue(prev, group.operation))
                      }}
                    >
                      <span
                        className={`material-symbols-rounded worktree-env-panel__platform-chevron ${
                          isPlatformGroupExpanded ? 'is-active' : ''
                        }`}
                      >
                        chevron_right
                      </span>
                    </button>
                  </div>
                  {isPlatformGroupExpanded && (
                    <WorktreeEnvironmentScriptEditorCard
                      scriptKey={selectedScript.script}
                      value={draftScripts[selectedScript.script]}
                      title={getScriptLabel(selectedScript.script, t)}
                      description={t('config.environments.platformScriptDescription', {
                        platform: t(`config.environments.platforms.${selectedScript.platform}`)
                      })}
                      onChange={onChange}
                      t={t}
                    />
                  )}
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
