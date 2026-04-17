import process from 'node:process'

import {
  getConfigSectionValueAtPath,
  hasConfigSectionValue,
  parseConfigSectionPath,
  resolveConfigSectionPath,
  setConfigSectionValueAtPath,
  unsetConfigSectionValueAtPath,
  updateConfigFile,
  validateConfigSection
} from '@vibe-forge/config'

import { resolveReadableConfigValue } from './display-state'
import { resolveSetPathInput, resolveSetValueInput, resolveWritableSource } from './interactive'
import { resolveReadState } from './read-state'
import { resolveClearedSectionValue, resolveListOutput, resolveTextListRows } from './section-state'
import {
  formatDisplayValue,
  formatValidationIssues,
  loadCommandState,
  parseConfigValueInput,
  printJsonResult,
  resolveSourceSections
} from './shared'
import type { ConfigGetOptions, ConfigListOptions, ConfigSetOptions, ConfigUnsetOptions } from './shared'

export const runListCommand = async (pathInput: string | undefined, opts: ConfigListOptions) => {
  const source = opts.source ?? 'merged'
  if (pathInput != null && pathInput.trim() !== '') {
    const resolved = await resolveReadState(pathInput, source === 'all' ? 'merged' : source)
    if (opts.json) {
      printJsonResult({
        ok: true,
        workspaceFolder: resolved.cwd,
        source: resolved.source,
        path: resolved.resolvedPath?.normalizedPath ?? null,
        section: resolved.resolvedPath?.section ?? null,
        value: resolved.value
      })
      return
    }
    process.stdout.write(formatDisplayValue(resolveReadableConfigValue(resolved)))
    return
  }

  const cwd = process.cwd()
  const state = await loadCommandState(cwd)
  if (opts.json) {
    const output = {
      ok: true,
      workspaceFolder: cwd,
      sections: resolveListOutput(state, source)
    } as const
    printJsonResult(
      source === 'all'
        ? {
          ...output,
          present: state.present
        }
        : output
    )
    return
  }
  console.log(`Workspace: ${cwd}`)
  console.log(
    `Config present: project=${state.present.project ? 'yes' : 'no'}, user=${state.present.user ? 'yes' : 'no'}`
  )
  console.table(resolveTextListRows(state, source))
  console.log('Examples:')
  console.log('  vf config get general.defaultModel')
  console.log('  vf config set general.defaultModel gpt-5.4 --type string')
}

export const runGetCommand = async (pathInput: string | undefined, opts: ConfigGetOptions) => {
  const resolved = await resolveReadState(pathInput, opts.source)
  if (opts.json) {
    printJsonResult({
      ok: true,
      workspaceFolder: resolved.cwd,
      source: resolved.source,
      path: resolved.resolvedPath?.normalizedPath ?? null,
      section: resolved.resolvedPath?.section ?? null,
      value: resolved.value
    })
    return
  }
  process.stdout.write(formatDisplayValue(resolveReadableConfigValue(resolved)))
}

export const runSetCommand = async (
  pathInput: string | undefined,
  valueInput: string | undefined,
  opts: ConfigSetOptions
) => {
  const cwd = process.cwd()
  const source = await resolveWritableSource(opts.source, opts.json)
  const path = await resolveSetPathInput(pathInput, opts.json)
  const type = opts.type ?? 'auto'
  const rawValue = await resolveSetValueInput(valueInput, type, opts.json)
  const nextValue = parseConfigValueInput(rawValue, type)
  const resolvedPath = resolveConfigSectionPath(parseConfigSectionPath(path))
  const state = await loadCommandState(cwd)
  const updatedSections = setConfigSectionValueAtPath(
    resolveSourceSections(state, source),
    resolvedPath,
    nextValue
  )
  const sectionValue = updatedSections[resolvedPath.section]
  const parsed = await validateConfigSection(resolvedPath.section, sectionValue, { cwd })
  if (!parsed.success) {
    throw new Error(`Invalid config value for ${resolvedPath.section}:\n${formatValidationIssues(parsed.error)}`)
  }

  const result = await updateConfigFile({
    workspaceFolder: cwd,
    source,
    section: resolvedPath.section,
    value: parsed.data
  })

  const updatedValue = getConfigSectionValueAtPath(updatedSections, resolvedPath).value
  if (opts.json) {
    printJsonResult({
      ok: true,
      workspaceFolder: cwd,
      source,
      path: resolvedPath.normalizedPath,
      section: resolvedPath.section,
      configPath: result.configPath,
      value: updatedValue
    })
    return
  }

  console.log(`Updated ${resolvedPath.normalizedPath} in ${source} config.`)
  console.log(`File: ${result.configPath}`)
  process.stdout.write(formatDisplayValue(updatedValue))
}

export const runUnsetCommand = async (
  pathInput: string | undefined,
  opts: ConfigUnsetOptions
) => {
  const cwd = process.cwd()
  const source = await resolveWritableSource(opts.source, opts.json)
  const path = await resolveSetPathInput(pathInput, opts.json)
  const resolvedPath = resolveConfigSectionPath(parseConfigSectionPath(path))
  const state = await loadCommandState(cwd)
  const currentSections = resolveSourceSections(state, source)
  const currentValue = getConfigSectionValueAtPath(currentSections, resolvedPath)
  if (!currentValue.exists || (resolvedPath.sectionPath.length === 0 && !hasConfigSectionValue(currentValue.value))) {
    throw new Error(`Config path "${resolvedPath.normalizedPath}" was not found in ${source} config.`)
  }

  const updatedSections = resolvedPath.sectionPath.length === 0
    ? {
      ...currentSections,
      [resolvedPath.section]: resolveClearedSectionValue(resolvedPath.section)
    }
    : unsetConfigSectionValueAtPath(currentSections, resolvedPath)

  const sectionValue = updatedSections[resolvedPath.section]
  const parsed = await validateConfigSection(resolvedPath.section, sectionValue, { cwd })
  if (!parsed.success) {
    throw new Error(`Invalid config value for ${resolvedPath.section}:\n${formatValidationIssues(parsed.error)}`)
  }

  const result = await updateConfigFile({
    workspaceFolder: cwd,
    source,
    section: resolvedPath.section,
    value: parsed.data
  })

  if (opts.json) {
    printJsonResult({
      ok: true,
      workspaceFolder: cwd,
      source,
      path: resolvedPath.normalizedPath,
      section: resolvedPath.section,
      configPath: result.configPath,
      removed: true
    })
    return
  }

  console.log(`Removed ${resolvedPath.normalizedPath} from ${source} config.`)
  console.log(`File: ${result.configPath}`)
}
