import type { Resource, i18n as I18nInstance } from 'i18next'

export type LocaleMessages = Record<string, unknown>

export interface LocaleModule {
  default: LocaleMessages
}

export type LocaleModuleMap = Record<string, LocaleModule>

export const getLocaleCodeFromPath = (path: string) => (
  path.match(/\/([^/]+)\.json$/)?.[1] ?? path
)

export const buildTranslationResources = (modules: LocaleModuleMap): Resource => (
  Object.fromEntries(
    Object.entries(modules).map(([path, mod]) => [
      getLocaleCodeFromPath(path),
      { translation: mod.default }
    ])
  )
)

export const applyHotTranslationUpdates = ({
  instance,
  modulePaths,
  nextModules
}: {
  instance: I18nInstance
  modulePaths: string[]
  nextModules: Array<LocaleModule | undefined>
}) => {
  modulePaths.forEach((path, index) => {
    const nextModule = nextModules[index]
    if (nextModule == null) return
    const localeCode = getLocaleCodeFromPath(path)
    instance.removeResourceBundle(localeCode, 'translation')
    instance.addResourceBundle(
      localeCode,
      'translation',
      nextModule.default
    )
  })
}
