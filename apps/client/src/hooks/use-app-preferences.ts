import { theme } from 'antd'
import { useAtomValue } from 'jotai'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'

import type { ConfigResponse } from '@vibe-forge/core'

import { getConfig } from '#~/api'
import { themeAtom } from '#~/store'

interface AppPreferences {
  isDarkMode: boolean
  themeConfig: {
    algorithm: typeof theme.darkAlgorithm | typeof theme.defaultAlgorithm
    token: {
      colorPrimary: string
    }
  }
}

export function useAppPreferences(): AppPreferences {
  const { i18n } = useTranslation()
  const themeMode = useAtomValue(themeAtom)
  const { data: configRes } = useSWR<ConfigResponse>('/api/config', getConfig)
  const interfaceLanguage = configRes?.sources?.merged?.general?.interfaceLanguage
  const isDarkMode = themeMode === 'dark' ||
    (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  useEffect(() => {
    if (interfaceLanguage && i18n.language !== interfaceLanguage) {
      void i18n.changeLanguage(interfaceLanguage)
    }
  }, [i18n, interfaceLanguage])

  const themeConfig = useMemo(() => ({
    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: isDarkMode ? '#3b82f6' : '#000000'
    }
  }), [isDarkMode])

  return {
    isDarkMode,
    themeConfig
  }
}
