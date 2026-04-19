import { App, Form } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import type { ConfigResponse } from '@vibe-forge/types'

import { getApiErrorMessage, updateConfig } from '#~/api.js'
import { buildPluginsWithRegistry, buildRegistrySource } from './skill-hub-utils'
import type { RegistryFormValues } from './skill-hub-utils'

export function useSkillRegistryModal({
  configRes,
  mutateConfig,
  mutateHub,
  setRegistry
}: {
  configRes?: ConfigResponse
  mutateConfig: () => Promise<unknown>
  mutateHub: () => Promise<unknown>
  setRegistry: (value: string) => void
}) {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form] = Form.useForm<RegistryFormValues>()

  const save = async () => {
    const values = await form.validateFields()
    const id = values.id.trim()
    const source = buildRegistrySource(values)
    const projectPlugins = configRes?.sources?.project?.plugins ?? {}
    const existingMarketplaces = projectPlugins.marketplaces ?? {}
    if (id === 'skills' || Object.hasOwn(existingMarketplaces, id)) {
      void message.warning(t('knowledge.skills.registryExists'))
      return
    }

    setSaving(true)
    try {
      await updateConfig('project', 'plugins', buildPluginsWithRegistry(projectPlugins, id, source))
      setRegistry(id)
      setOpen(false)
      form.resetFields()
      await Promise.all([mutateConfig(), mutateHub()])
      void message.success(t('knowledge.skills.registrySaved'))
    } catch (error) {
      void message.error(getApiErrorMessage(error, t('config.saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  return {
    form,
    open,
    save,
    saving,
    setOpen
  }
}
