import React, { useEffect, useState } from 'react'
import { codeToHtml } from 'shiki'

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

  useEffect(() => {
    let isMounted = true
    codeToHtml(code, {
      lang,
      theme: 'github-light',
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
  }, [code, lang, showLineNumbers])

  if (!html) {
    return (
      <pre style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
        <code>{code}</code>
      </pre>
    )
  }

  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
