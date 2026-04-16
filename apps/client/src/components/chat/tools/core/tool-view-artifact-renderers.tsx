import type { ToolViewArtifact } from '@vibe-forge/types'

import { CodeBlock } from '#~/components/CodeBlock'
import { MarkdownContent } from '#~/components/MarkdownContent'
import { safeJsonStringify } from '#~/utils/safe-serialize'

import { ToolDiffViewer } from './ToolDiffViewer'

export function ToolViewArtifactRenderer({
  artifact,
  display,
  splitLabel,
  inlineLabel
}: {
  artifact: ToolViewArtifact
  display: ToolViewArtifact['kind']
  splitLabel: string
  inlineLabel: string
}) {
  if (artifact.kind === 'diff' && display === 'diff') {
    return (
      <ToolDiffViewer
        original={artifact.original}
        modified={artifact.modified}
        language={artifact.language}
        splitLabel={splitLabel}
        inlineLabel={inlineLabel}
      />
    )
  }

  if (artifact.kind === 'markdown' && display === 'markdown') {
    return <MarkdownContent content={artifact.value} />
  }

  if (artifact.kind === 'code' && display === 'code') {
    return <CodeBlock code={artifact.value} lang={artifact.language ?? 'text'} hideHeader={true} />
  }

  if (artifact.kind === 'json' && display === 'json') {
    return <CodeBlock code={safeJsonStringify(artifact.value, 2)} lang='json' hideHeader={true} />
  }

  if (artifact.kind === 'list' && display === 'list') {
    return (
      <div className='tool-detail-list'>
        {artifact.items.map(item => (
          <div className='tool-detail-list-item' key={item}>{item}</div>
        ))}
      </div>
    )
  }

  if (artifact.kind === 'image' && display === 'image') {
    return (
      <div className='tool-result-image-wrapper'>
        <img className='tool-result-image' src={artifact.src} alt={artifact.alt ?? ''} />
        {artifact.title != null && artifact.title !== '' && (
          <div className='tool-result-image-caption'>{artifact.title}</div>
        )}
      </div>
    )
  }

  if (artifact.kind === 'text' && display === 'text') {
    return <div className='tool-detail-section__text'>{artifact.value}</div>
  }

  return <CodeBlock code={safeJsonStringify(artifact, 2)} lang='json' hideHeader={true} />
}
