import type { ChannelMiddleware } from './@types'

export type LanguageCode = 'zh' | 'en'

export type MessageArgs = Record<string, string | number | boolean | undefined>
type MessageTemplate = string | ((args: MessageArgs) => string)

export type MessageCatalog = Record<string, MessageTemplate>

const catalogs: Record<string, MessageCatalog> = {}

/**
 * Register i18n messages for a given language.
 * Can be called multiple times — later calls merge into existing entries.
 */
export const defineMessages = (lang: LanguageCode, messages: MessageCatalog) => {
  catalogs[lang] = { ...catalogs[lang], ...messages }
}

const DEFAULT_LANGUAGE: LanguageCode = 'zh'

export const t = (lang: LanguageCode | undefined, key: string, args?: MessageArgs): string => {
  const locale = lang ?? DEFAULT_LANGUAGE
  const template = catalogs[locale]?.[key] ?? catalogs[DEFAULT_LANGUAGE]?.[key]
  if (template == null) return key
  if (typeof template === 'function') return template(args ?? {})
  if (args) {
    return template.replace(/\{(\w+)\}/g, (_, k: string) => String(args[k] ?? ''))
  }
  return template
}

export const createT = (lang: LanguageCode | undefined) => (key: string, args?: MessageArgs): string =>
  t(lang, key, args)

export const i18nMiddleware: ChannelMiddleware = async (ctx, next) => {
  ctx.defineMessages = defineMessages
  ctx.t = (key, args) => {
    const language = (ctx.config as Record<string, unknown> | undefined)?.language as LanguageCode | undefined
    return t(language, key, args)
  }
  await next()
}
