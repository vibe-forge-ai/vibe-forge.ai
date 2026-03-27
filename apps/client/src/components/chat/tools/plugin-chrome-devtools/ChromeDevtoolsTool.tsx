import './ChromeDevtoolsTool.scss'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { CodeBlock } from '#~/components/CodeBlock'
import { safeJsonStringify } from '#~/utils/safe-serialize'
import { ToolCallBox } from '../core/ToolCallBox'
import { defineToolRender } from '../defineToolRender'

const formatToolName = (name: string) => {
  if (name.startsWith('mcp__ChromeDevtools__')) {
    return name.replace('mcp__ChromeDevtools__', '')
  }
  return name
}

export const ChromeDevtoolsTool = defineToolRender(({ item, resultItem }) => {
  const { t } = useTranslation()
  const displayName = formatToolName(item.name)
  const input = item.input != null ? item.input : {}

  return (
    <div className='tool-group chrome-devtools-tool'>
      <ToolCallBox
        defaultExpanded={true}
        header={
          <div className='tool-header-content'>
            <i className='tool-header-icon chrome-devtools-tool__icon devicon-chrome-plain colored' />
            <span className='tool-header-title'>{displayName}</span>
            <span className='tool-header-hint'>{t('chat.tools.call')}</span>
          </div>
        }
        content={
          <div className='tool-content'>
            <CodeBlock
              code={safeJsonStringify(input, 2)}
              lang='json'
            />
          </div>
        }
      />
      {resultItem != null && (
        <ToolCallBox
          type='result'
          isError={resultItem.is_error}
          header={
            <div className='tool-header-content'>
              <span className='material-symbols-rounded tool-header-icon'>
                {resultItem.is_error === true ? 'error' : 'check_circle'}
              </span>
              <span className='tool-header-title'>{t('chat.result')}</span>
            </div>
          }
          content={
            <div className='tool-content'>
              {typeof resultItem.content === 'string'
                ? (
                  <CodeBlock
                    code={resultItem.content}
                    lang='text'
                  />
                )
                : (
                  <CodeBlock
                    code={safeJsonStringify(resultItem.content, 2)}
                    lang='json'
                  />
                )}
            </div>
          }
        />
      )}
    </div>
  )
})
