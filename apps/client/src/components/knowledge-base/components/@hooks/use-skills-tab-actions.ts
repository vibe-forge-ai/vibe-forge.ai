import React from 'react'

import type { MessageInstance } from 'antd/es/message/interface'
import type { TFunction } from 'i18next'

import type { SkillHubItem } from '#~/api.js'
import { getApiErrorMessage, importSkillArchive, installSkillHubItem } from '#~/api.js'

export const useSkillsTabActions = (params: {
  marketMutate: () => Promise<unknown>
  message: MessageInstance
  mutateConfig: () => Promise<unknown>
  mutateSkills: () => Promise<unknown>
  onRefresh: () => void | Promise<void>
  t: TFunction
}) => {
  const importInputRef = React.useRef<HTMLInputElement | null>(null)
  const [installingId, setInstallingId] = React.useState<string | null>(null)
  const [importing, setImporting] = React.useState(false)

  const handleRefresh = React.useCallback(async () => {
    await Promise.all([params.mutateSkills(), params.marketMutate(), params.mutateConfig(), params.onRefresh()])
  }, [params])

  const handleInstall = React.useCallback(async (item: SkillHubItem) => {
    setInstallingId(item.id)
    try {
      await installSkillHubItem({
        registry: item.registry,
        plugin: item.installRef ?? item.name,
        force: item.installed
      })
      await Promise.all([params.marketMutate(), params.mutateSkills()])
      void params.message.success(params.t('knowledge.skills.installSuccess'))
    } catch (error) {
      void params.message.error(getApiErrorMessage(error, params.t('knowledge.skills.installFailed')))
    } finally {
      setInstallingId(null)
    }
  }, [params])

  const handleImportArchive = React.useCallback(async (file: File) => {
    setImporting(true)
    try {
      const result = await importSkillArchive(file)
      await Promise.all([params.mutateSkills(), params.onRefresh()])
      void params.message.success(params.t('knowledge.skills.importSuccess', { count: result.fileCount }))
    } catch (error) {
      void params.message.error(getApiErrorMessage(error, params.t('knowledge.skills.importFailed')))
    } finally {
      setImporting(false)
    }
  }, [params])

  return {
    importInputRef,
    importing,
    installingId,
    handleImportArchive,
    handleInstall,
    handleRefresh
  }
}
