import type { ChatMessageContent } from './message'

export interface ToolViewBadge {
  label: string
  tone?: 'default' | 'warning' | 'error'
}

export interface ToolViewSummary {
  title: string
  icon?: string
  primary?: string
  status?: 'pending' | 'running' | 'success' | 'error'
  badges?: ToolViewBadge[]
}

export interface ToolViewField {
  label: string
  value: unknown
  format?: 'inline' | 'text' | 'code' | 'json' | 'list'
  language?: string
}

export type ToolViewArtifact =
  | { id: string; kind: 'text'; value: string }
  | { id: string; kind: 'markdown'; value: string }
  | { id: string; kind: 'code'; value: string; language?: string }
  | { id: string; kind: 'json'; value: unknown }
  | { id: string; kind: 'diff'; original: string; modified: string; language?: string }
  | { id: string; kind: 'list'; items: string[] }
  | { id: string; kind: 'image'; src: string; alt?: string; title?: string }

export type ToolViewSection =
  | { type: 'fields'; fields: ToolViewField[] }
  | {
    type: 'artifact'
    artifactId: string
    display: ToolViewArtifact['kind']
  }
  | { type: 'notice'; tone?: 'default' | 'warning' | 'error'; text: string }

export interface ToolView {
  defaultExpanded?: boolean
  sections: ToolViewSection[]
}

export interface ToolViewEnvelope {
  version: 1
  toolViewId: string
  sourceMessageId: string
  toolUseId: string
  revision: number
  summary: ToolViewSummary
  call?: ToolView
  result?: ToolView
  artifacts?: ToolViewArtifact[]
  textFallback: string
}

export interface ToolPresentationInput {
  adapterInstanceId?: string
  sourceMessageId: string
  toolUse: Extract<ChatMessageContent, { type: 'tool_use' }>
  toolResult?: Extract<ChatMessageContent, { type: 'tool_result' }>
}
