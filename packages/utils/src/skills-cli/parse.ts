/* eslint-disable no-control-regex, regexp/no-super-linear-backtracking, regexp/no-useless-lazy -- skills CLI parsing accepts terminal control characters and permissive table layouts. */
import { normalizeNonEmptyString, stripAnsi } from './shared'
import type { SkillsCliFindResult, SkillsCliListedSkill } from './types'

export const parseSkillsCliListOutput = (output: string): SkillsCliListedSkill[] => {
  const lines = stripAnsi(output)
    .split(/\r?\n/)
    .map(line => line.replace(/\u0008/g, '').trimEnd())
  const listedSkills: SkillsCliListedSkill[] = []
  let currentSkill: SkillsCliListedSkill | undefined
  let inAvailableSection = false

  const pushCurrentSkill = () => {
    if (currentSkill == null) return
    listedSkills.push({
      name: currentSkill.name,
      ...(normalizeNonEmptyString(currentSkill.description) != null
        ? { description: normalizeNonEmptyString(currentSkill.description) }
        : {})
    })
    currentSkill = undefined
  }

  for (const line of lines) {
    const plainEntryMatch = line.match(/^\s{2}(\S.+?)\s+-\s+(.+)$/)
    if (plainEntryMatch != null) {
      pushCurrentSkill()
      listedSkills.push({
        name: plainEntryMatch[1].trim(),
        description: plainEntryMatch[2].trim()
      })
      continue
    }

    if (!inAvailableSection) {
      if (line.includes('Available Skills')) {
        inAvailableSection = true
      }
      continue
    }

    if (line.includes('Use --skill <name>')) break
    const fancyNameMatch = line.match(/^\s*│\s{4}(\S.*)$/)
    if (fancyNameMatch != null) {
      pushCurrentSkill()
      currentSkill = { name: fancyNameMatch[1].trim() }
      continue
    }

    const fancyDescriptionMatch = line.match(/^\s*│\s{6}(.+)$/)
    if (fancyDescriptionMatch != null) {
      if (currentSkill == null) continue
      currentSkill.description = currentSkill.description == null
        ? fancyDescriptionMatch[1].trim()
        : `${currentSkill.description} ${fancyDescriptionMatch[1].trim()}`
      continue
    }

    if (line.trim() === '' || line.trim() === '│') continue
  }

  pushCurrentSkill()
  return listedSkills
}

export const parseSkillsCliFindOutput = (output: string): SkillsCliFindResult[] => {
  const lines = stripAnsi(output)
    .split(/\r?\n/)
    .map(line => line.replace(/\u0008/g, '').trim())
  const results: SkillsCliFindResult[] = []
  let currentResult: SkillsCliFindResult | undefined

  const pushCurrentResult = () => {
    if (currentResult == null) return
    results.push(currentResult)
    currentResult = undefined
  }

  for (const line of lines) {
    if (line === '' || line.startsWith('Install with ') || line.startsWith('No skills found')) {
      continue
    }

    if (line.startsWith('└ ')) {
      if (currentResult != null) {
        currentResult.url = line.slice(2).trim()
        pushCurrentResult()
      }
      continue
    }

    const match = line.match(/^(\S+@\S+)\s+(.+? installs.*?)$/)
    if (match == null) continue

    pushCurrentResult()
    const installRef = match[1].trim()
    const atIndex = installRef.lastIndexOf('@')
    if (atIndex <= 0 || atIndex >= installRef.length - 1) continue

    currentResult = {
      installRef,
      source: installRef.slice(0, atIndex),
      skill: installRef.slice(atIndex + 1),
      installsLabel: match[2].trim()
    }
  }

  pushCurrentResult()
  return results
}
