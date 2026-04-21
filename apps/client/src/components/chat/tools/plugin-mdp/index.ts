import { defineToolRenders } from '../defineToolRender'
import { MdpTool } from './MdpTool'

export const mdpToolRenders = defineToolRenders({
  listClients: MdpTool,
  listPaths: MdpTool,
  callPath: MdpTool,
  callPaths: MdpTool
}, {
  namespace: 'mcp__MDP__'
})

export { MdpTool }
