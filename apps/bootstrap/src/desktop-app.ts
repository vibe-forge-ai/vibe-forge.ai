import { spawn } from 'node:child_process'
import process from 'node:process'

import { ensureDesktopInstall } from './desktop-install'
import type { DesktopInstallMode } from './desktop-mode'
import { readDesktopPreference, resolveInstallMode } from './desktop-mode'
import { selectDesktopAsset } from './desktop-release'

export type { DesktopInstallMode } from './desktop-mode'

export interface LaunchDesktopAppOptions {
  forwardedArgs: string[]
  installMode?: DesktopInstallMode
  persistInstallMode?: boolean
}

export const launchDesktopApp = async (options: LaunchDesktopAppOptions) => {
  const installMode = await resolveInstallMode({
    explicitInstallMode: options.installMode,
    persistInstallMode: options.persistInstallMode
  })
  const install = await ensureDesktopInstall(installMode)
  const workspaceFolder = process.cwd()
  console.error(`[bootstrap] launching desktop app from ${install.installedPath} (${installMode})`)

  const child = spawn(install.executablePath, options.forwardedArgs, {
    cwd: workspaceFolder,
    detached: true,
    env: {
      ...process.env,
      VF_DESKTOP_WORKSPACE: workspaceFolder,
      __VF_PROJECT_WORKSPACE_FOLDER__: workspaceFolder
    },
    stdio: 'ignore'
  })

  child.unref()
}

export const __TEST_ONLY__ = {
  readDesktopPreference,
  resolveInstallMode,
  selectDesktopAsset
}
