import { defineToolRenders } from '../defineToolRender'
import { BashTool } from './BashTool'
import { GlobTool } from './GlobTool'
import { GrepTool } from './GrepTool'
import { LsTool } from './LSTool'
import { ReadTool } from './ReadTool'
import { TodoTool } from './TodoTool'
import { WriteTool } from './WriteTool'

export const adapterClaudeToolRenders = defineToolRenders({
  Bash: BashTool,
  LS: LsTool,
  Glob: GlobTool,
  Grep: GrepTool,
  Read: ReadTool,
  Write: WriteTool,
  TodoWrite: TodoTool
})

export {
  BashTool,
  GlobTool,
  GrepTool,
  LsTool,
  ReadTool,
  TodoTool,
  WriteTool
}
