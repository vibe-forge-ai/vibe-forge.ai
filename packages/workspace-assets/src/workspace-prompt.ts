import type { WorkspaceDefinitionPayload } from '@vibe-forge/types'
import { CANONICAL_VIBE_FORGE_MCP_SERVER_NAME, resolvePromptPath } from '@vibe-forge/utils'

import { buildManagedTaskToolGuidance } from './task-tool-guidance'

export const generateWorkspaceRoutePrompt = (
  cwd: string,
  workspaces: WorkspaceDefinitionPayload[]
) => {
  if (workspaces.length === 0) return ''
  const taskToolGuidance = buildManagedTaskToolGuidance(CANONICAL_VIBE_FORGE_MCP_SERVER_NAME)

  const workspaceList = workspaces
    .map((workspace) => {
      const description = workspace.description?.trim() || workspace.name?.trim() || workspace.path
      return (
        `  - Identifier: ${workspace.id}\n` +
        `    - Path: ${resolvePromptPath(cwd, workspace.cwd)}\n` +
        `    - Description: ${description}\n`
      )
    })
    .join('')

  return (
    '<system-prompt>\n' +
    'The project includes the following registered workspaces:\n' +
    `${workspaceList}\n` +
    `When a user request targets one of these workspaces, start a child task with \`${CANONICAL_VIBE_FORGE_MCP_SERVER_NAME}.StartTasks\` using \`type: "workspace"\` and \`name\` set to the workspace identifier. ` +
    'Do not directly edit files inside a registered workspace from the current session unless the user explicitly asks this session to work in that directory.\n' +
    `${taskToolGuidance}\n` +
    '</system-prompt>\n'
  )
}
