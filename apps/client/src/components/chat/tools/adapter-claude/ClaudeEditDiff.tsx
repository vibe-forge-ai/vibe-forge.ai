import React from 'react'
import { useTranslation } from 'react-i18next'

import { ToolDiffViewer } from '../core/ToolDiffViewer'
import type { ToolDiffMetaItem } from '../core/ToolDiffViewer'

export function ClaudeEditDiff({
  oldValue,
  newValue,
  lang,
  metaItems = [],
}: {
  oldValue?: string
  newValue?: string
  lang?: string
  metaItems?: ToolDiffMetaItem[]
}) {
  const { t } = useTranslation()

  return (
    <ToolDiffViewer
      original={oldValue ?? ''}
      modified={newValue ?? ''}
      language={lang}
      metaItems={metaItems}
      splitLabel={t('chat.tools.diffSplit')}
      inlineLabel={t('chat.tools.diffInline')}
    />
  )
}
