import './CodeBlock.scss'
import { useAtomValue } from 'jotai'
import React, { useEffect, useState } from 'react'
import { codeToHtml } from 'shiki'
import { themeAtom } from '../../store'

export function CodeBlock({
  code,
  lang = 'json',
  showLineNumbers = false
}: {
  code: string
  lang?: string
  showLineNumbers?: boolean
}) {
  const [html, setHtml] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const themeMode = useAtomValue(themeAtom)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  const getLangIcon = (language: string) => {
    const lang = language.toLowerCase()
    const iconMap: Record<string, string> = {
      js: 'javascript-plain',
      javascript: 'javascript-plain',
      ts: 'typescript-plain',
      typescript: 'typescript-plain',
      html: 'html5-plain',
      css: 'css3-plain',
      python: 'python-plain',
      py: 'python-plain',
      java: 'java-plain',
      cpp: 'cplusplus-plain',
      c: 'c-plain',
      csharp: 'csharp-plain',
      cs: 'csharp-plain',
      go: 'go-original-wordmark',
      rust: 'rust-original',
      rs: 'rust-original',
      php: 'php-plain',
      ruby: 'ruby-plain',
      rb: 'ruby-plain',
      swift: 'swift-plain',
      kotlin: 'kotlin-plain',
      kt: 'kotlin-plain',
      scala: 'scala-plain',
      shell: 'bash-plain',
      sh: 'bash-plain',
      bash: 'bash-plain',
      sql: 'sqlline-plain',
      json: 'json-plain',
      yaml: 'yaml-plain',
      yml: 'yaml-plain',
      markdown: 'markdown-original',
      md: 'markdown-original',
      docker: 'docker-plain',
      dockerfile: 'docker-plain',
      react: 'react-original',
      jsx: 'react-original',
      tsx: 'react-original',
      vue: 'vuejs-plain',
      angular: 'angularjs-plain',
      sass: 'sass-original',
      scss: 'sass-original',
      less: 'less-plain-wordmark',
      stylus: 'stylus-plain',
      mongodb: 'mongodb-plain',
      mysql: 'mysql-plain',
      postgresql: 'postgresql-plain',
      redis: 'redis-plain',
      git: 'git-plain',
      npm: 'npm-original-wordmark',
      yarn: 'yarn-plain',
      nginx: 'nginx-original',
      bash_profile: 'bash-plain'
    }

    const iconClass = iconMap[lang] || 'code-plain'
    return <i className={`devicon-${iconClass} colored`} style={{ fontSize: '14px' }} />
  }

  useEffect(() => {
    let isMounted = true
    const isDark = themeMode === 'dark'
      || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    void codeToHtml(code, {
      lang,
      theme: isDark ? 'github-dark' : 'github-light',
      transformers: showLineNumbers
        ? [
          {
            name: 'line-numbers',
            line(node, line) {
              node.children.unshift({
                type: 'element',
                tagName: 'span',
                properties: {
                  class: 'line-number',
                  style:
                    'display: inline-block; width: 2rem; margin-right: 1rem; text-align: right; color: #9ca3af; user-select: none;'
                },
                children: [{ type: 'text', value: String(line) }]
              })
            }
          }
        ]
        : []
    }).then(h => {
      if (isMounted) setHtml(h)
    })
    return () => {
      isMounted = false
    }
  }, [code, lang, showLineNumbers, themeMode])

  if (html === '') {
    return (
      <div className='code-block-wrapper'>
        <div className='code-block-header'>
          <div className='code-lang-container'>
            {getLangIcon(lang)}
            <span className='code-lang'>{lang}</span>
          </div>
          <button
            className='copy-button'
            onClick={() => {
              void handleCopy()
            }}
          >
            <span className='material-symbols-rounded'>
              {copied ? 'check' : 'content_copy'}
            </span>
          </button>
        </div>
        <pre style={{ margin: 0, padding: 12, fontSize: 12, color: '#4b5563', overflowX: 'auto' }}>
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className='code-block-wrapper'>
      <div className='code-block-header'>
        <div className='code-lang-container'>
          {getLangIcon(lang)}
          <span className='code-lang'>{lang}</span>
        </div>
        <button
          className='copy-button'
          onClick={() => {
            void handleCopy()
          }}
        >
          <span className='material-symbols-rounded'>
            {copied ? 'check' : 'content_copy'}
          </span>
        </button>
      </div>
      <div
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
