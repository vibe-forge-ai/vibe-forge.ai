import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { isCancel, select } from '@clack/prompts'

import { resolveBootstrapDataDir } from './paths'

export type DesktopInstallMode = 'cache' | 'user'

interface DesktopPreferenceState {
  installMode?: DesktopInstallMode
}

const DEFAULT_INSTALL_MODE: DesktopInstallMode = 'user'

const ensureDirectory = async (targetPath: string) => {
  await mkdir(targetPath, { recursive: true })
}

const resolveDesktopPreferencePath = () => path.join(resolveBootstrapDataDir(), 'desktop', 'preferences.json')

const readJsonFile = async <T>(filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf8')
    return JSON.parse(content) as T
  } catch {
    return undefined
  }
}

const writeJsonFile = async (filePath: string, value: unknown) => {
  await ensureDirectory(path.dirname(filePath))
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

export const readDesktopPreference = async () => (
  await readJsonFile<DesktopPreferenceState>(resolveDesktopPreferencePath())
)

const writeDesktopPreference = async (installMode: DesktopInstallMode) => {
  await writeJsonFile(resolveDesktopPreferencePath(), { installMode })
}

const promptDesktopInstallMode = async () => {
  const selectedMode = await select<DesktopInstallMode>({
    message: 'Choose how to launch the desktop app',
    options: [
      {
        value: 'user',
        label: 'User directory',
        hint: 'Install into the user application directory'
      },
      {
        value: 'cache',
        label: 'Bootstrap cache',
        hint: 'Keep the app inside the bootstrap cache'
      }
    ]
  })

  if (isCancel(selectedMode)) {
    throw new Error('Desktop launch was cancelled.')
  }

  return selectedMode
}

export const resolveInstallMode = async (input: {
  explicitInstallMode?: DesktopInstallMode
  persistInstallMode?: boolean
}) => {
  if (input.explicitInstallMode != null) {
    if (input.persistInstallMode === true) {
      await writeDesktopPreference(input.explicitInstallMode)
    }
    return input.explicitInstallMode
  }

  const preference = await readDesktopPreference()
  if (preference?.installMode != null) {
    return preference.installMode
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return DEFAULT_INSTALL_MODE
  }

  const selectedMode = await promptDesktopInstallMode()
  await writeDesktopPreference(selectedMode)
  return selectedMode
}
