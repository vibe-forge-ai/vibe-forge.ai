import { defineToolRenders } from '../defineToolRender'
import { GetTaskInfoTool } from './GetTaskInfoTool'
import { ListTasksTool } from './ListTasksTool'
import { StartTasksTool } from './StartTasksTool'

export const taskToolRenders = defineToolRenders({
  StartTasks: StartTasksTool,
  GetTaskInfo: GetTaskInfoTool,
  ListTasks: ListTasksTool
}, {
  namespace: 'mcp__VibeForge__'
})

export { GetTaskInfoTool, ListTasksTool, StartTasksTool }
export { TaskToolCard } from './components/TaskToolCard'
