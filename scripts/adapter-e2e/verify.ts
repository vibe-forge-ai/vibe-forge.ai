import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { repoRoot, waitForPath } from './runtime'
import { MANAGED_ARTIFACTS } from './scenarios'
import type { AdapterE2ETarget, VerifiedManagedArtifact } from './types'

export const resolveLogPath = (ctxId: string, sessionId: string) => (
  path.resolve(repoRoot, '.ai/logs', ctxId, `${sessionId}.log.md`)
)

export const readHookLog = async (input: {
  ctxId: string
  sessionId: string
}) => {
  const logPath = resolveLogPath(input.ctxId, input.sessionId)
  const exists = await waitForPath(logPath, 2_000)
  if (!exists) {
    throw new Error(`Smoke log not found: ${logPath}`)
  }

  let content = ''
  let previousContent = ''
  let stableReads = 0
  const deadline = Date.now() + 3_000
  const requireSessionEnd = input.ctxId.includes('hooks-smoke-codex-')

  while (Date.now() < deadline) {
    content = await readFile(logPath, 'utf8')
    if (content === previousContent) {
      stableReads += 1
    } else {
      previousContent = content
      stableReads = 0
    }

    const hasStop = content.includes('[Stop]')
    const hasSessionEnd = content.includes('[SessionEnd]')
    if (
      (requireSessionEnd && hasSessionEnd && stableReads >= 2) ||
      (!requireSessionEnd && (
        (hasSessionEnd && stableReads >= 2) ||
        (hasStop && stableReads >= 10)
      ))
    ) {
      break
    }

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  if (!content.includes('"redacted": true') && !content.includes('redacted: true')) {
    throw new Error(`Expected sanitized hook log payload in ${logPath}`)
  }
  if (content.includes('hook-smoke-local')) {
    throw new Error(`Log leaked mock api key in ${logPath}`)
  }

  return {
    logPath,
    content
  }
}

const resolveArtifactPath = (
  filePath: string,
  sessionId: string
) => filePath.replace(':sessionId', sessionId)

export const collectManagedArtifacts = async (input: {
  adapter: AdapterE2ETarget
  sessionId: string
}): Promise<VerifiedManagedArtifact[]> => {
  const definitions = MANAGED_ARTIFACTS[input.adapter]
  const results: VerifiedManagedArtifact[] = []

  for (const definition of definitions) {
    let matchedCandidate: VerifiedManagedArtifact | undefined

    for (const candidate of definition.candidates) {
      const candidatePath = resolveArtifactPath(candidate.path, input.sessionId)
      const exists = await waitForPath(candidatePath, 5_000)
      if (!exists) continue

      const content = await readFile(candidatePath, 'utf8')
      const missing = candidate.includes.find(needle => !content.includes(needle))
      if (missing != null) continue

      matchedCandidate = {
        label: definition.label,
        path: candidatePath,
        includes: candidate.includes,
        content
      }
      break
    }

    if (matchedCandidate == null) {
      const attemptedPaths = definition.candidates
        .map(candidate => resolveArtifactPath(candidate.path, input.sessionId))
        .join(', ')
      throw new Error(
        `Managed artifact ${definition.label} not satisfied by any candidate: ${attemptedPaths}`
      )
    }

    results.push(matchedCandidate)
  }

  return results
}
