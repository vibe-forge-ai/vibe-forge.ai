import React from 'react'

import { Form } from 'antd'
import type { MessageInstance } from 'antd/es/message/interface'
import type { TFunction } from 'i18next'

import type { SkillHubItem } from '#~/api.js'
import { getApiErrorMessage, installSkillsCliItem, searchSkillsCli } from '#~/api.js'
import type { SkillsCliFormValues } from '../SkillsCliModal'

const SKILLS_CLI_INITIAL_LIMIT = 100
const SKILLS_CLI_LIMIT_STEP = 100
const SKILLS_CLI_MAX_LIMIT = 500

const trimOptionalString = (value: string | undefined) => {
  const normalizedValue = value?.trim()
  return normalizedValue == null || normalizedValue === '' ? undefined : normalizedValue
}

export const useSkillsCliModalController = (params: {
  message: MessageInstance
  mutateSkills: () => Promise<unknown>
  t: TFunction
}) => {
  const [open, setOpen] = React.useState(false)
  const [searching, setSearching] = React.useState(false)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [installingId, setInstallingId] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<SkillHubItem[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)
  const [limit, setLimit] = React.useState(SKILLS_CLI_INITIAL_LIMIT)
  const [resetKey, setResetKey] = React.useState('')
  const [form] = Form.useForm<SkillsCliFormValues>()

  const resolveRequest = React.useCallback(async () => {
    try {
      await form.validateFields(['source'])
    } catch {
      return undefined
    }

    const values = form.getFieldsValue()
    const source = values.source.trim()
    return {
      source,
      query: trimOptionalString(values.query),
      registry: trimOptionalString(values.registry)
    }
  }, [form])

  const runSearch = React.useCallback(async (nextLimit: number) => {
    const request = await resolveRequest()
    if (request == null) return false

    const result = await searchSkillsCli({
      limit: nextLimit,
      source: request.source,
      ...(request.query != null ? { query: request.query } : {}),
      ...(request.registry != null ? { registry: request.registry } : {})
    })

    setHasSearched(true)
    setLimit(nextLimit)
    setItems(result.items)
    setError(result.error ?? null)
    setHasMore(result.hasMore === true && nextLimit < SKILLS_CLI_MAX_LIMIT)
    setResetKey([request.source, request.query ?? '', request.registry ?? '', String(nextLimit)].join('\0'))
    return true
  }, [resolveRequest])

  const handleSearch = React.useCallback(async () => {
    setSearching(true)
    setLoadingMore(false)
    try {
      await runSearch(SKILLS_CLI_INITIAL_LIMIT)
    } catch (error) {
      void params.message.error(getApiErrorMessage(error, params.t('knowledge.skills.skillsCliSearchFailed')))
    } finally {
      setSearching(false)
    }
  }, [params, runSearch])

  const handleLoadMore = React.useCallback(async () => {
    const nextLimit = Math.min(limit + SKILLS_CLI_LIMIT_STEP, SKILLS_CLI_MAX_LIMIT)
    if (nextLimit === limit) return

    setLoadingMore(true)
    try {
      await runSearch(nextLimit)
    } catch (error) {
      void params.message.error(getApiErrorMessage(error, params.t('knowledge.skills.skillsCliSearchFailed')))
    } finally {
      setLoadingMore(false)
    }
  }, [limit, params, runSearch])

  const handleInstall = React.useCallback(async (item: SkillHubItem) => {
    const request = await resolveRequest()
    if (request == null) return

    setInstallingId(item.id)
    try {
      await installSkillsCliItem({
        source: request.source,
        skill: item.installRef ?? item.name,
        force: item.installed,
        ...(request.registry != null ? { registry: request.registry } : {})
      })
      await params.mutateSkills()
      try {
        await runSearch(limit)
      } catch {
        // Keep the install success state even if refreshing the source list fails afterwards.
      }
      void params.message.success(params.t('knowledge.skills.installSuccess'))
    } catch (error) {
      void params.message.error(getApiErrorMessage(error, params.t('knowledge.skills.installFailed')))
    } finally {
      setInstallingId(null)
    }
  }, [limit, params, resolveRequest, runSearch])

  const handleClose = React.useCallback(() => {
    setOpen(false)
    setSearching(false)
    setLoadingMore(false)
    setInstallingId(null)
    setItems([])
    setError(null)
    setHasMore(false)
    setHasSearched(false)
    setLimit(SKILLS_CLI_INITIAL_LIMIT)
    setResetKey('')
    form.resetFields()
  }, [form])

  return {
    form,
    hasMore,
    hasSearched,
    installingId,
    items,
    limit,
    loadingMore,
    open,
    resetKey,
    searching,
    searchError: error,
    setOpen,
    handleClose,
    handleInstall,
    handleLoadMore,
    handleSearch
  }
}
