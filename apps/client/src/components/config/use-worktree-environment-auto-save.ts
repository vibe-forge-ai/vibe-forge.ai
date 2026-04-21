/* eslint-disable max-lines -- auto-save and conflict resolution share one state machine here. */
import { useEffect, useRef } from 'react'

import type { ConfigSource } from '@vibe-forge/core'
import type {
  WorktreeEnvironmentDetail,
  WorktreeEnvironmentScriptKey,
  WorktreeEnvironmentSummary
} from '@vibe-forge/types'

import { deleteWorktreeEnvironment, getApiErrorMessage, saveWorktreeEnvironment } from '#~/api'

import { resolveRemoteConfigChangeAction, serializeComparableConfigValue } from './configConflict'
import type { TranslationFn } from './configUtils'
import {
  buildDraftScripts,
  toDisplayEnvironmentName,
  toEnvironmentIdForSource
} from './worktree-environment-panel-model'

const AUTO_SAVE_DELAY_MS = 800

const serializeDraftScripts = (scripts: Record<WorktreeEnvironmentScriptKey, string>) => (
  serializeComparableConfigValue(scripts)
)

interface SyncedEnvironmentDraft {
  id: string
  name: string
  scripts: string
}

interface MessageApi {
  error: (content: string) => unknown
}

interface ModalApi {
  confirm: (options: {
    title: string
    content: string
    okText: string
    cancelText: string
    cancelButtonProps?: { danger?: boolean }
    closable?: boolean
    keyboard?: boolean
    maskClosable?: boolean
    onOk?: () => unknown
    onCancel?: () => unknown
  }) => unknown
}

export function useWorktreeEnvironmentAutoSave({
  draftEnvironmentId,
  draftScripts,
  environments,
  message,
  modal,
  nameDraft,
  selectedEnvironment,
  selectedId,
  sourceKey,
  refreshDetail,
  refreshEnvironments,
  setDraftEnvironmentId,
  setDraftScripts,
  setNameDraft,
  setSelectedId,
  t
}: {
  draftEnvironmentId?: string
  draftScripts: Record<WorktreeEnvironmentScriptKey, string>
  environments: WorktreeEnvironmentSummary[]
  message: MessageApi
  modal: ModalApi
  nameDraft: string
  selectedEnvironment?: WorktreeEnvironmentDetail
  selectedId?: string
  sourceKey: ConfigSource
  refreshDetail: () => Promise<unknown>
  refreshEnvironments: () => Promise<unknown>
  setDraftEnvironmentId: (id?: string) => void
  setDraftScripts: (scripts: Record<WorktreeEnvironmentScriptKey, string>) => void
  setNameDraft: (value: string) => void
  setSelectedId: (id: string) => void
  t: TranslationFn
}) {
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const syncedDraftRef = useRef<SyncedEnvironmentDraft>()
  const pendingConflictRef = useRef<{
    remoteDraft: SyncedEnvironmentDraft
    remoteScripts: Record<WorktreeEnvironmentScriptKey, string>
  }>()
  const draftStateRef = useRef<{
    id?: string
    name: string
    scripts: Record<WorktreeEnvironmentScriptKey, string>
    serializedScripts: string
  }>({
    id: draftEnvironmentId,
    name: nameDraft,
    scripts: draftScripts,
    serializedScripts: serializeDraftScripts(draftScripts)
  })
  const blockedRef = useRef(false)
  const conflictModalOpenRef = useRef(false)

  const clearAutoSaveTimer = () => {
    if (autoSaveTimerRef.current == null) return
    clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = undefined
  }

  const applyRemoteDraft = ({
    remoteDraft,
    remoteScripts
  }: {
    remoteDraft: SyncedEnvironmentDraft
    remoteScripts: Record<WorktreeEnvironmentScriptKey, string>
  }) => {
    setDraftEnvironmentId(remoteDraft.id)
    setDraftScripts(remoteScripts)
    setNameDraft(remoteDraft.name)
    syncedDraftRef.current = remoteDraft
  }

  useEffect(() => {
    draftStateRef.current = {
      id: draftEnvironmentId,
      name: nameDraft,
      scripts: draftScripts,
      serializedScripts: serializeDraftScripts(draftScripts)
    }
  }, [draftEnvironmentId, draftScripts, nameDraft])

  useEffect(() => {
    if (selectedEnvironment == null) {
      clearAutoSaveTimer()
      setDraftEnvironmentId(undefined)
      setDraftScripts(buildDraftScripts())
      setNameDraft('')
      syncedDraftRef.current = undefined
      pendingConflictRef.current = undefined
      blockedRef.current = false
      conflictModalOpenRef.current = false
      return
    }

    const remoteScripts = buildDraftScripts(selectedEnvironment)
    const remoteDraft: SyncedEnvironmentDraft = {
      id: selectedEnvironment.id,
      name: toDisplayEnvironmentName(selectedEnvironment.id),
      scripts: serializeDraftScripts(remoteScripts)
    }
    const syncedDraft = syncedDraftRef.current

    if (syncedDraft == null) {
      applyRemoteDraft({ remoteDraft, remoteScripts })
      return
    }

    if (
      syncedDraft.id === remoteDraft.id &&
      syncedDraft.name === remoteDraft.name &&
      syncedDraft.scripts === remoteDraft.scripts
    ) {
      return
    }

    const currentDraft = draftStateRef.current
    const currentSerialized = serializeComparableConfigValue({
      id: currentDraft.id ?? '',
      name: currentDraft.name,
      scripts: currentDraft.serializedScripts
    })
    const syncedSerialized = serializeComparableConfigValue({
      ...syncedDraft
    })
    const remoteSerialized = serializeComparableConfigValue({
      ...remoteDraft
    })
    const action = resolveRemoteConfigChangeAction({
      baseSerialized: syncedSerialized,
      draftSerialized: currentSerialized,
      serverSerialized: remoteSerialized
    })

    if (action === 'sync-remote') {
      clearAutoSaveTimer()
      blockedRef.current = false
      pendingConflictRef.current = undefined
      applyRemoteDraft({ remoteDraft, remoteScripts })
      return
    }

    if (action === 'conflict') {
      clearAutoSaveTimer()
      blockedRef.current = true
      pendingConflictRef.current = { remoteDraft, remoteScripts }

      if (conflictModalOpenRef.current) {
        return
      }

      conflictModalOpenRef.current = true
      modal.confirm({
        title: t('config.conflict.title'),
        content: t('config.conflict.description', {
          source: t(`config.environments.sources.${sourceKey}`),
          target: remoteDraft.name
        }),
        okText: t('config.conflict.keepLocal'),
        cancelText: t('config.conflict.useRemote'),
        cancelButtonProps: { danger: true },
        closable: false,
        keyboard: false,
        maskClosable: false,
        onOk: async () => {
          const currentDraftState = draftStateRef.current
          const currentSelectedId = currentDraftState.id ?? selectedId
          const nextId = toEnvironmentIdForSource(currentDraftState.name, sourceKey)

          if (currentSelectedId == null || nextId === '') {
            void message.error(t('config.environments.saveFailed'))
            throw new Error('worktree environment draft is not ready to save')
          }

          const saved = await saveEnvironmentDraft({
            draftScripts: currentDraftState.scripts,
            message,
            nextId,
            refreshDetail,
            refreshEnvironments,
            selectedId: currentSelectedId,
            serializedScripts: serializeDraftScripts(currentDraftState.scripts),
            setSelectedId,
            sourceKey,
            t
          })

          if (!saved) {
            throw new Error('failed to save worktree environment draft')
          }

          blockedRef.current = false
          pendingConflictRef.current = undefined
          conflictModalOpenRef.current = false
        },
        onCancel: () => {
          const pendingConflict = pendingConflictRef.current
          if (pendingConflict != null) {
            applyRemoteDraft(pendingConflict)
          }
          blockedRef.current = false
          pendingConflictRef.current = undefined
          conflictModalOpenRef.current = false
        }
      })
      return
    }

    syncedDraftRef.current = remoteDraft
    blockedRef.current = false
    pendingConflictRef.current = undefined
  }, [
    message,
    modal,
    refreshDetail,
    refreshEnvironments,
    selectedEnvironment,
    selectedId,
    setDraftEnvironmentId,
    setDraftScripts,
    setNameDraft,
    setSelectedId,
    sourceKey,
    t
  ])

  useEffect(() => () => {
    clearAutoSaveTimer()
  }, [])

  useEffect(() => {
    if (selectedId == null || draftEnvironmentId !== selectedId) return
    if (blockedRef.current) {
      clearAutoSaveTimer()
      return
    }
    const nextId = toEnvironmentIdForSource(nameDraft, sourceKey)
    if (nextId === '') return

    const serializedScripts = serializeDraftScripts(draftScripts)
    const syncedDraft = syncedDraftRef.current
    if (syncedDraft?.id === selectedId && syncedDraft.name === nameDraft && syncedDraft.scripts === serializedScripts) {
      return
    }
    if (
      nextId !== selectedId && environments.some(environment => (
        environment.id === nextId && environment.source === sourceKey
      ))
    ) {
      void message.error(t('config.environments.exists'))
      return
    }

    if (autoSaveTimerRef.current != null) {
      clearAutoSaveTimer()
    }
    autoSaveTimerRef.current = setTimeout(() => {
      if (blockedRef.current) return
      void saveEnvironmentDraft({
        draftScripts,
        message,
        nextId,
        refreshDetail,
        refreshEnvironments,
        selectedId,
        serializedScripts,
        setSelectedId,
        sourceKey,
        t
      })
    }, AUTO_SAVE_DELAY_MS)

    return () => {
      clearAutoSaveTimer()
    }
  }, [
    draftEnvironmentId,
    draftScripts,
    environments,
    message,
    nameDraft,
    refreshDetail,
    refreshEnvironments,
    selectedId,
    setSelectedId,
    sourceKey,
    t
  ])

  async function saveEnvironmentDraft({
    draftScripts,
    message,
    nextId,
    refreshDetail,
    refreshEnvironments,
    selectedId,
    serializedScripts,
    setSelectedId,
    sourceKey,
    t
  }: {
    draftScripts: Record<WorktreeEnvironmentScriptKey, string>
    message: MessageApi
    nextId: string
    refreshDetail: () => Promise<unknown>
    refreshEnvironments: () => Promise<unknown>
    selectedId: string
    serializedScripts: string
    setSelectedId: (id: string) => void
    sourceKey: ConfigSource
    t: TranslationFn
  }) {
    try {
      await saveWorktreeEnvironment(nextId, { scripts: draftScripts }, sourceKey)
      if (nextId !== selectedId) {
        await deleteWorktreeEnvironment(selectedId, sourceKey)
        setSelectedId(nextId)
      }
      syncedDraftRef.current = {
        id: nextId,
        name: toDisplayEnvironmentName(nextId),
        scripts: serializedScripts
      }
      await refreshEnvironments()
      if (nextId === selectedId) {
        await refreshDetail()
      }
      return true
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('config.environments.saveFailed')))
      return false
    }
  }
}
