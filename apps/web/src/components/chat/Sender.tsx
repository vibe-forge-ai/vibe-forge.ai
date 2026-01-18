import './Sender.scss'
import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { message, Tooltip, Input } from 'antd'

const { TextArea } = Input;
import { ThinkingStatus } from './ThinkingStatus'
import { CompletionMenu, CompletionItem } from './CompletionMenu'
import type { SessionInfo } from '#~/types'

export function Sender({ 
  onSend, 
  isThinking, 
  onInterrupt,
  sessionInfo
}: { 
  onSend: (text: string) => void, 
  isThinking: boolean,
  onInterrupt: () => void,
  sessionInfo?: SessionInfo | null
}) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [showCompletion, setShowCompletion] = useState(false)
  const [completionItems, setCompletionItems] = useState<CompletionItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [triggerChar, setTriggerChar] = useState<string | null>(null)
  
  const [showToolsList, setShowToolsList] = useState(false)
  const textareaRef = useRef<any>(null)
  const toolsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setShowToolsList(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSend = () => {
    if (!input.trim() || isThinking) return
    onSend(input)
    setInput('')
    setShowCompletion(false)
  }

  const handleSelectCompletion = (item: CompletionItem) => {
    if (!triggerChar || !textareaRef.current) return;
    
    const cursorFallback = textareaRef.current.selectionStart;
    const textBeforeTrigger = input.slice(0, input.lastIndexOf(triggerChar, cursorFallback - 1));
    const textAfterCursor = input.slice(cursorFallback);
    
    const newValue = textBeforeTrigger + triggerChar + item.value + ' ' + textAfterCursor;
    setInput(newValue);
    setShowCompletion(false);
    
    // Focus back and set cursor
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = textBeforeTrigger.length + triggerChar.length + item.value.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }

  const handleTriggerClick = (char: string) => {
    if (!textareaRef.current) return
    const cursor = textareaRef.current.selectionStart
    const textBefore = input.slice(0, cursor)
    const textAfter = input.slice(cursor)
    
    // Check if we need to add a space before the trigger char
    const needsSpaceBefore = textBefore.length > 0 && !textBefore.endsWith(' ')
    const trigger = needsSpaceBefore ? ` ${char}` : char
    
    const newValue = textBefore + trigger + textAfter
    setInput(newValue)
    
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = cursor + trigger.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newPos, newPos)
        
        // Trigger handleInputChange logic manually
        const event = { target: textareaRef.current } as any
        handleInputChange(event)
      }
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCompletion) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % completionItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + completionItems.length) % completionItems.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (completionItems[selectedIndex]) {
          handleSelectCompletion(completionItems[selectedIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCompletion(false);
        return;
      }
    }

    // Cmd/Ctrl + Enter to send
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    const cursor = e.target.selectionStart;
    const charBeforeCursor = value[cursor - 1];

    if (['/', '@', '#'].includes(charBeforeCursor)) {
      setTriggerChar(charBeforeCursor);
      let items: CompletionItem[] = [];
      
      if (charBeforeCursor === '/') {
        items = (sessionInfo?.slashCommands || []).map(cmd => ({
          label: `/${cmd}`,
          value: cmd,
          icon: 'terminal'
        }));
      } else if (charBeforeCursor === '@') {
        items = (sessionInfo?.agents || []).map(agent => ({
          label: `@${agent}`,
          value: agent,
          icon: 'smart_toy'
        }));
      } else if (charBeforeCursor === '#') {
        items = (sessionInfo?.tools || []).map(tool => ({
          label: `#${tool}`,
          value: tool,
          icon: 'check_box'
        }));
      }

      if (items.length > 0) {
        setCompletionItems(items);
        setSelectedIndex(0);
        setShowCompletion(true);
      } else {
        setShowCompletion(false);
      }
    } else if (showCompletion) {
      // Filter logic could go here if needed
      if (!value.includes(triggerChar || '')) {
        setShowCompletion(false);
      }
    }
  };

  return (
    <div className="chat-input-wrapper">
      {isThinking && <ThinkingStatus />}
      <div className="chat-input-container">
        {showCompletion && (
          <CompletionMenu
            items={completionItems}
            selectedIndex={selectedIndex}
            onSelect={handleSelectCompletion}
            onClose={() => setShowCompletion(false)}
          />
        )}
        <TextArea
          ref={textareaRef}
          className="chat-input-textarea"
          placeholder={t('chat.inputPlaceholder')}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoSize={{ minRows: 1, maxRows: 10 }}
          variant="borderless"
        />
        
        <div className="chat-input-toolbar">
          <div className="toolbar-left">
            <Tooltip title="快捷指令">
              <div className="toolbar-btn" onClick={() => handleTriggerClick('/')}>
                <span className="material-symbols-outlined">terminal</span>
              </div>
            </Tooltip>
            <Tooltip title="提及代理">
              <div className="toolbar-btn" onClick={() => handleTriggerClick('@')}>
                <span className="material-symbols-outlined">smart_toy</span>
              </div>
            </Tooltip>
            <Tooltip title="注入上下文">
              <div className="toolbar-btn" onClick={() => handleTriggerClick('#')}>
                <span className="material-symbols-outlined">description</span>
              </div>
            </Tooltip>
            <Tooltip title="上传图片">
              <div className="toolbar-btn" onClick={() => message.info('图片上传功能尚不支持')}>
                <span className="material-symbols-outlined">image</span>
              </div>
            </Tooltip>

            {sessionInfo && (
              <div className="session-info-toolbar" ref={toolsRef}>
                <div 
                  className={`info-item ${showToolsList ? 'active' : ''}`} 
                  onClick={() => setShowToolsList(!showToolsList)}
                >
                  <span className="material-symbols-outlined">build</span>
                  <span className="info-text">{t('chat.toolsCount', { count: sessionInfo.tools.length })}</span>
                  <span className="material-symbols-outlined arrow-icon">keyboard_arrow_up</span>
                </div>

                {showToolsList && (
                  <div className="tools-list-popup">
                    <div className="popup-header">已激活工具</div>
                    <div className="popup-content">
                      {sessionInfo.tools.map(tool => (
                        <div key={tool} className="tool-item">
                          <span className="material-symbols-outlined">check_box</span>
                          <span className="tool-name">{tool}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="toolbar-right">
            <Tooltip title="切换模型">
              <div className="toolbar-btn model-switcher" onClick={() => message.info('模型切换功能尚不支持')}>
                <span className="material-symbols-outlined">variable_insert</span>
                <span className="model-name">{sessionInfo?.model || 'GPT-4o'}</span>
                <span className="material-symbols-outlined arrow">keyboard_arrow_down</span>
              </div>
            </Tooltip>
            
            <div 
              className={`chat-send-btn ${input.trim() ? 'active' : ''} ${isThinking ? 'thinking' : ''}`}
              onClick={isThinking ? onInterrupt : handleSend}
            >
              <span className="material-symbols-outlined">
                {isThinking ? 'stop_circle' : 'send'}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="chat-input-hint">
        {t('chat.hint')}
      </div>
    </div>
  )
}
