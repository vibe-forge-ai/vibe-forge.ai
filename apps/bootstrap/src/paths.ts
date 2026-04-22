import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

export const resolveRealHomeDir = () => {
  const realHome = process.env.__VF_PROJECT_REAL_HOME__?.trim()
  if (realHome) {
    return realHome
  }

  return os.homedir()
}

export const resolveBootstrapDataDir = () => path.join(resolveRealHomeDir(), '.vibe-forge', 'bootstrap')
