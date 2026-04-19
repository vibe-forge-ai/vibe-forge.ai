import { CodeBlock } from '#~/components/CodeBlock'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownContent({
  content
}: {
  content: string
}) {
  return (
    <div className='markdown-body'>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            return <>{children}</>
          },
          table({ children, ...props }: any) {
            return (
              <div className='markdown-table-wrapper'>
                <table {...props}>{children}</table>
              </div>
            )
          },
          code({ inline, className, children, ...props }: any) {
            const langClass = typeof className === 'string' ? className : ''
            const match = /language-(\w+)/.exec(langClass)
            const isInline = inline === true
            const codeContent = String(children).replace(/\n$/, '')
            return !isInline && match != null
              ? (
                <CodeBlock
                  code={codeContent}
                  lang={match[1]}
                />
              )
              : (
                <code className={langClass} {...props}>
                  {children}
                </code>
              )
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
