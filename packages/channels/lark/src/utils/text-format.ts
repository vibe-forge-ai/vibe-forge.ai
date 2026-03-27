import type { LarkMention } from '#~/types.js'

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const escapeXmlText = (value: string) => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export const escapeXmlAttr = (value: string) => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export const resolveLarkId = (id?: { open_id?: string | null; user_id?: string | null; union_id?: string | null }) => {
  return id?.open_id ?? id?.user_id ?? id?.union_id ?? undefined
}

export const formatLarkText = (
  rawText: string | undefined,
  mentions?: LarkMention[]
) => {
  if (rawText == null || rawText === '') return undefined
  let text = rawText

  if (Array.isArray(mentions)) {
    for (const mention of mentions) {
      const key = mention.key
      const name = mention.name
      const id = resolveLarkId(mention.id)
      if (key == null || key === '' || name == null || name === '' || id == null || id === '') continue
      const replacement = `<at type="lark" user_id="${escapeXmlAttr(id)}">` +
        `${escapeXmlText(name)}` +
        `</at>`
      text = text.replace(new RegExp(escapeRegExp(key), 'g'), replacement)
    }
  }

  text = text.replace(/`(https?:\/\/[^`\s]+)`/g, '$1')
  text = text.replace(/\\`(https?:\/\/[^`\\s]+)\\`/g, '$1')
  return text
}
