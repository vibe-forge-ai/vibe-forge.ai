import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { parseScopedReference } from '@vibe-forge/definition-core'
import type { Definition } from '@vibe-forge/types'
import { normalizePath } from '@vibe-forge/utils'
import fm from 'front-matter'

export const loadLocalDocuments = async <Attrs extends object>(
  paths: string[]
): Promise<Definition<Attrs>[]> => {
  const promises = paths.map(async (path) => {
    const content = await readFile(path, 'utf-8')
    const { body, attributes } = fm<Attrs>(content)
    return {
      path,
      body,
      attributes
    }
  })
  return Promise.all(promises)
}

export const resolveUniqueDefinition = <TDefinition extends { name?: string }>(
  definitions: Definition<TDefinition>[],
  ref: string,
  resolveIdentifier: (definition: Definition<TDefinition>) => string
) => {
  const scoped = parseScopedReference(ref)
  if (scoped != null) {
    return definitions.find(definition => definition.resolvedName === ref)
  }

  const matches = definitions.filter(definition => resolveIdentifier(definition) === ref)
  if (matches.length === 0) return undefined
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous asset reference ${ref}. Candidates: ${
        matches.map(item => item.resolvedName ?? resolveIdentifier(item)).join(', ')
      }`
    )
  }
  return matches[0]
}

export const resolveRulePattern = (pattern: string, baseDir: string) => {
  const trimmed = pattern.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return normalizePath(resolve(baseDir, trimmed))
  }

  return trimmed
}
