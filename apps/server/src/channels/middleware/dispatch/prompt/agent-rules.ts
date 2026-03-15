import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cwd, env } from 'node:process'

/**
 * Tries to load `AGENTS.channel.<channelType>.md` from:
 *   1. <projectRoot>/AGENTS.channel.<channelType>.md
 *   2. <projectRoot>/.ai/rules/AGENTS.channel.<channelType>.md
 * Returns the first file found, or undefined.
 */
export const loadChannelAgentRules = async (channelType: string): Promise<string | undefined> => {
  const filename = `AGENTS.channel.${channelType}.md`
  const root = env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? cwd()
  const candidates = [
    join(root, filename),
    join(root, '.ai', 'rules', filename)
  ]
  for (const candidate of candidates) {
    try {
      const content = await readFile(candidate, 'utf8')
      if (content.trim()) return content.trim()
    } catch {
      // file not found — try next candidate
    }
  }
  return undefined
}
