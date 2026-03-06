import './BashTool.scss'
import type { ToolInputs } from '@vibe-forge/core'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CodeBlock } from '../../CodeBlock'
import { ToolCallBox } from '../../ToolCallBox'
import { safeJsonStringify } from '../../safeSerialize'
import { defineToolRender } from '../defineToolRender'

export const BashTool = defineToolRender(({ item, resultItem }) => {
  const { t } = useTranslation()
  const input = (item.input != null ? item.input : {}) as Partial<ToolInputs['adapter:claude-code:Bash']>
  const command = input.command ?? ''
  const reason = (input.description != null && input.description !== '')
    ? input.description
    : (input.reason != null && input.reason !== '')
    ? input.reason
    : (input.thought != null && input.thought !== '')
    ? input.thought
    : ''
  const timeout = input.timeout
  const runInBackground = input.run_in_background
  const dangerouslyDisableSandbox = input.dangerouslyDisableSandbox
  const reasonLine = reason.replaceAll('\n', ' ').replace(/\s+/g, ' ').trim()
  const commandLine = command.split('\n')[0] ?? ''
  const hasMoreCommand = command.trim() !== commandLine.trim()
  const showCommandExpand = hasMoreCommand || commandLine.length > 80
  const [showCommandDetail, setShowCommandDetail] = useState(false)

  return (
    <div className='tool-group bash-tool'>
      <ToolCallBox
        defaultExpanded={true}
        type={resultItem != null ? 'result' : 'call'}
        isError={resultItem?.is_error ?? false}
        header={
          <div className='bash-tool__header'>
            <span className='material-symbols-rounded bash-tool__icon'>terminal</span>
            <div className='bash-tool__header-main'>
              <div className='bash-tool__reason-row'>
                <span className='bash-tool__reason-text tool-header-hint'>
                  {reasonLine !== '' ? reasonLine : commandLine}
                </span>
              </div>
              {reasonLine !== '' && (
                <div className='bash-tool__command-row'>
                  <span
                    className={`bash-tool__command-text tool-header-mono${
                      showCommandExpand ? ' bash-tool__command-text--clickable' : ''
                    }`}
                    title={showCommandExpand ? t('chat.tools.viewCommand') : undefined}
                    onClick={(e) => {
                      if (!showCommandExpand) return
                      e.stopPropagation()
                      setShowCommandDetail(prev => !prev)
                    }}
                  >
                    {commandLine}
                    {hasMoreCommand ? ' …' : ''}
                  </span>
                </div>
              )}
            </div>
            <div className='bash-tool__header-tags'>
              {typeof timeout === 'number' && Number.isFinite(timeout) && (
                <span
                  className='tool-icon-tag'
                  title={`${t('chat.tools.timeout')}: ${timeout}ms`}
                >
                  <span className='material-symbols-rounded tool-icon-tag__icon'>timer</span>
                  <span className='tool-icon-tag__text'>
                    {timeout % 1000 === 0 ? `${timeout / 1000}s` : `${timeout}ms`}
                  </span>
                </span>
              )}
              {runInBackground === true && (
                <span className='tool-icon-tag' title={t('chat.tools.runInBackground')}>
                  <span className='material-symbols-rounded tool-icon-tag__icon'>schedule</span>
                </span>
              )}
              {dangerouslyDisableSandbox === true && (
                <span className='tool-icon-tag' title={t('chat.tools.dangerouslyDisableSandbox')}>
                  <span className='material-symbols-rounded tool-icon-tag__icon'>shield_lock</span>
                </span>
              )}
            </div>
          </div>
        }
        content={
          <div className='tool-content'>
            {showCommandDetail && (
              <div className='bash-tool__command-detail'>
                <div className='tool-code-wrapper'>
                  <CodeBlock code={command} lang='shell' hideHeader={true} />
                </div>
              </div>
            )}
            <div className='tool-scroll'>
              <div className='tool-code-wrapper'>
                {resultItem
                  ? (typeof resultItem.content === 'string'
                    ? <CodeBlock code={resultItem.content} lang='text' hideHeader={true} />
                    : <CodeBlock code={safeJsonStringify(resultItem.content, 2)} lang='json' hideHeader={true} />)
                  : (
                    <div className='tool-placeholder'>
                      {t('chat.result')}
                    </div>
                  )}
              </div>
            </div>
          </div>
        }
      />
    </div>
  )
})
