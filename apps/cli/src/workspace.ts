import process from 'node:process'

import { resolveProjectWorkspaceFolder } from '@vibe-forge/utils'

export const resolveCliWorkspaceCwd = (
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env
) => {
  const workspaceCwd = resolveProjectWorkspaceFolder(cwd, env)
  env.__VF_PROJECT_WORKSPACE_FOLDER__ = workspaceCwd
  return workspaceCwd
}
