import { defineToolRenders } from '../defineToolRender'
import { GetTaskInfoTool } from './GetTaskInfoTool'
import { StartTasksTool } from './StartTasksTool'

export const taskToolRenders = defineToolRenders({
  StartTasks: StartTasksTool,
  GetTaskInfo: GetTaskInfoTool
}, {
  namespace: 'mcp__VibeForge__'
})

export { GetTaskInfoTool, StartTasksTool }
export { TaskToolCard } from './components/TaskToolCard'
