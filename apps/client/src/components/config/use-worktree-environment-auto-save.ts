import { useEffect, useRef } from 'react'

import type { ConfigSource } from '@vibe-forge/core'
import type {
  WorktreeEnvironmentDetail,
  WorktreeEnvironmentScriptKey,
  WorktreeEnvironmentSummary
} from '@vibe-forge/types'

import { deleteWorktreeEnvironment, getApiErrorMessage, saveWorktreeEnvironment } from '#~/api'

import type { TranslationFn } from './configUtils'
import {
  buildDraftScripts,
  toDisplayEnvironmentName,
  toEnvironmentIdForSource
} from './worktree-environment-panel-model'

const AUTO_SAVE_DELAY_MS = 800

const serializeDraftScripts = (scripts: Record<WorktreeEnvironmentScriptKey, string>) => JSON.stringify(scripts)

interface MessageApi {
  error: (content: string) => unknown
}

export function useWorktreeEnvironmentAutoSave({
  draftEnvironmentId,
  draftScripts,
  environments,
  message,
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
  const syncedDraftRef = useRef<{ id: string; name: string; scripts: string }>()

  useEffect(() => {
    if (selectedEnvironment == null) {
      setDraftEnvironmentId(undefined)
      setDraftScripts(buildDraftScripts())
      setNameDraft('')
      syncedDraftRef.current = undefined
      return
    }

    const scripts = buildDraftScripts(selectedEnvironment)
    const name = toDisplayEnvironmentName(selectedEnvironment.id)
    setDraftEnvironmentId(selectedEnvironment.id)
    setDraftScripts(scripts)
    setNameDraft(name)
    syncedDraftRef.current = {
      id: selectedEnvironment.id,
      name,
      scripts: serializeDraftScripts(scripts)
    }
  }, [selectedEnvironment, setDraftEnvironmentId, setDraftScripts, setNameDraft])

  useEffect(() => () => {
    if (autoSaveTimerRef.current != null) {
      clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (selectedId == null || draftEnvironmentId !== selectedId) return
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
      clearTimeout(autoSaveTimerRef.current)
    }
    autoSaveTimerRef.current = setTimeout(() => {
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
      if (autoSaveTimerRef.current != null) {
        clearTimeout(autoSaveTimerRef.current)
      }
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
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('config.environments.saveFailed')))
    }
  }
}
