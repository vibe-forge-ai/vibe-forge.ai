import type { ChromeDevtoolsToolName } from '@vibe-forge/plugin-chrome-devtools/schema'

import type { ToolRenderComponent } from '../defineToolRender'
import { defineToolRenders } from '../defineToolRender'
import { ChromeDevtoolsTool } from './ChromeDevtoolsTool'

const chromeDevtoolsToolNames: ChromeDevtoolsToolName[] = [
  'mcp__ChromeDevtools__click',
  'mcp__ChromeDevtools__close_page',
  'mcp__ChromeDevtools__drag',
  'mcp__ChromeDevtools__emulate',
  'mcp__ChromeDevtools__evaluate_script',
  'mcp__ChromeDevtools__fill',
  'mcp__ChromeDevtools__fill_form',
  'mcp__ChromeDevtools__get_console_message',
  'mcp__ChromeDevtools__get_network_request',
  'mcp__ChromeDevtools__handle_dialog',
  'mcp__ChromeDevtools__hover',
  'mcp__ChromeDevtools__list_console_messages',
  'mcp__ChromeDevtools__list_network_requests',
  'mcp__ChromeDevtools__list_pages',
  'mcp__ChromeDevtools__navigate_page',
  'mcp__ChromeDevtools__new_page',
  'mcp__ChromeDevtools__performance_analyze_insight',
  'mcp__ChromeDevtools__performance_start_trace',
  'mcp__ChromeDevtools__performance_stop_trace',
  'mcp__ChromeDevtools__press_key',
  'mcp__ChromeDevtools__resize_page',
  'mcp__ChromeDevtools__select_page',
  'mcp__ChromeDevtools__take_memory_snapshot',
  'mcp__ChromeDevtools__take_screenshot',
  'mcp__ChromeDevtools__take_snapshot',
  'mcp__ChromeDevtools__type_text',
  'mcp__ChromeDevtools__upload_file',
  'mcp__ChromeDevtools__wait_for'
]

const chromeDevtoolsToolEntries = chromeDevtoolsToolNames.reduce<Record<string, ToolRenderComponent>>((acc, name) => {
  acc[name] = ChromeDevtoolsTool
  return acc
}, {})

export const chromeDevtoolsToolRenders = defineToolRenders(chromeDevtoolsToolEntries)

export { ChromeDevtoolsTool }
