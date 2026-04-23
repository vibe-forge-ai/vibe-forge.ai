import { defineToolRenders } from '../defineToolRender'
import { GenericClaudeTool } from './GenericClaudeTool'
export { buildClaudeToolPresentation, getClaudeToolBaseName, isClaudeToolName } from './claude-tool-presentation'
export { getClaudeToolSummaryText } from './claude-tool-summary'

export const adapterClaudeToolRenders = defineToolRenders({
  AskUserQuestion: GenericClaudeTool,
  Bash: GenericClaudeTool,
  Edit: GenericClaudeTool,
  EnterPlanMode: GenericClaudeTool,
  ExitPlanMode: GenericClaudeTool,
  LS: GenericClaudeTool,
  Glob: GenericClaudeTool,
  Grep: GenericClaudeTool,
  NotebookEdit: GenericClaudeTool,
  Read: GenericClaudeTool,
  Skill: GenericClaudeTool,
  Task: GenericClaudeTool,
  TaskCreate: GenericClaudeTool,
  TaskGet: GenericClaudeTool,
  TaskList: GenericClaudeTool,
  TaskUpdate: GenericClaudeTool,
  WebFetch: GenericClaudeTool,
  WebSearch: GenericClaudeTool,
  Write: GenericClaudeTool,
  TodoWrite: GenericClaudeTool
}, { namespace: 'adapter:claude-code:' })

export { GenericClaudeTool }
