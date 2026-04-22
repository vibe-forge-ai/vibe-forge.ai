import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { applyHotTranslationUpdates, buildTranslationResources } from './i18n-resources'
import type { LocaleModule, LocaleModuleMap } from './i18n-resources'

const localeModules = import.meta.glob('./resources/locales/*.json', {
  eager: true
}) as LocaleModuleMap
const localeModulePaths = Object.keys(localeModules).sort()

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: buildTranslationResources(localeModules),
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false
    },
    react: {
      bindI18nStore: 'added'
    }
  })

if (import.meta.hot) {
  import.meta.hot.accept(localeModulePaths, (nextModules) => {
    applyHotTranslationUpdates({
      instance: i18n,
      modulePaths: localeModulePaths,
      nextModules: nextModules as Array<LocaleModule | undefined>
    })
  })
}

export default i18n
