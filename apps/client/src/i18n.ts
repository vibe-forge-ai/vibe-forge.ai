import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from './resources/locales/en.json'
import zh from './resources/locales/zh.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en }
    },
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
