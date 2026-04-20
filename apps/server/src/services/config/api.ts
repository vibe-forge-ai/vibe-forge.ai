import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import {
  buildConfigSections,
  composeBaseConfigSchemaBundle,
  composeWorkspaceConfigSchemaBundle,
  updateConfigFile,
  validateConfigSection,
  writeWorkspaceConfigSchemaFile
} from '@vibe-forge/config'
import type { AdapterBuiltinModel, Config, ConfigResponse, ConfigSchemaResponse } from '@vibe-forge/types'
import { resolveProjectAiBaseDirName } from '@vibe-forge/utils'

import { reloadChannels } from '#~/channels/index.js'
import { getWorkspaceFolder, loadConfigState } from '#~/services/config/index.js'
import { startLocalMdpRootServer } from '#~/services/mdp/root-server.js'
import { startServerMdpRuntime } from '#~/services/mdp/runtime.js'
import { badRequest } from '#~/utils/http.js'

const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => sanitize(item))
  }
  if (value != null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      acc[key] = sanitize(val)
      return acc
    }, {})
  }
  return value
}

interface AppInfo {
  lastReleaseAt?: string
  version?: string
}

const getAppInfo = async (workspaceFolder: string): Promise<AppInfo> => {
  try {
    const pkgPath = resolve(workspaceFolder, 'package.json')
    const content = await readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(content) as { lastReleaseAt?: string; releaseDate?: string; version?: string }
    return {
      version: pkg.version,
      lastReleaseAt: pkg.lastReleaseAt ?? pkg.releaseDate
    }
  } catch {
    return {}
  }
}

const buildSections = (config: Config | undefined) => {
  const sections = sanitize(buildConfigSections(config)) as ReturnType<typeof buildConfigSections>

  return {
    ...sections,
    adapterBuiltinModels: {} as Record<string, AdapterBuiltinModel[]>
  }
}

const loadAdapterBuiltinModels = (
  adapters: Config['adapters']
): Record<string, AdapterBuiltinModel[]> => {
  const result: Record<string, AdapterBuiltinModel[]> = {}
  if (!adapters) return result
  for (const adapterKey of Object.keys(adapters)) {
    try {
      const packageName = adapterKey.startsWith('@') ? adapterKey : `@vibe-forge/adapter-${adapterKey}`
      // eslint-disable-next-line ts/no-require-imports
      const mod = require(`${packageName}/models`)
      if (Array.isArray(mod?.builtinModels)) {
        result[adapterKey] = mod.builtinModels
      }
    } catch {
      // Adapter does not export builtin models — skip
    }
  }
  return result
}

export const loadConfigSchemaResponse = async (): Promise<ConfigSchemaResponse> => {
  const workspaceFolder = getWorkspaceFolder()
  const [base, workspace] = await Promise.all([
    Promise.resolve(composeBaseConfigSchemaBundle()),
    composeWorkspaceConfigSchemaBundle({ cwd: workspaceFolder })
  ])

  return {
    base: {
      jsonSchema: base.jsonSchema,
      extensions: base.extensions
    },
    workspace: {
      jsonSchema: workspace.jsonSchema,
      uiSchema: workspace.uiSchema,
      extensions: workspace.extensions
    }
  }
}

export const generateWorkspaceConfigSchema = async () => {
  const workspaceFolder = getWorkspaceFolder()
  const { outputPath, bundle } = await writeWorkspaceConfigSchemaFile({ cwd: workspaceFolder })
  return {
    ok: true,
    outputPath,
    extensions: bundle.extensions
  }
}

export const loadConfigResponse = async (): Promise<ConfigResponse> => {
  const { workspaceFolder, projectConfig, userConfig, mergedConfig } = await loadConfigState()
  const urls = {
    repo: 'https://github.com/vibe-forge-ai/vibe-forge.ai',
    docs: 'https://github.com/vibe-forge-ai/vibe-forge.ai',
    contact: 'https://github.com/vibe-forge-ai/vibe-forge.ai',
    issues: 'https://github.com/vibe-forge-ai/vibe-forge.ai/issues',
    releases: 'https://github.com/vibe-forge-ai/vibe-forge.ai/releases'
  }
  const appInfo = await getAppInfo(workspaceFolder)
  const mergedSections = buildSections(mergedConfig)
  mergedSections.general.baseDir = process.env.__VF_PROJECT_AI_BASE_DIR__ != null
    ? resolveProjectAiBaseDirName(process.env)
    : mergedConfig.baseDir ?? resolveProjectAiBaseDirName(process.env)
  mergedSections.adapterBuiltinModels = loadAdapterBuiltinModels(mergedConfig.adapters)

  return {
    sources: {
      project: buildSections(projectConfig),
      user: buildSections(userConfig),
      merged: mergedSections
    },
    meta: {
      workspaceFolder,
      configPresent: {
        project: projectConfig != null,
        user: userConfig != null
      },
      experiments: {},
      about: {
        version: appInfo.version,
        lastReleaseAt: appInfo.lastReleaseAt,
        urls
      }
    }
  }
}

export const updateConfigSectionAndReload = async (params: {
  section: string
  source: 'project' | 'user'
  value: unknown
}) => {
  const workspaceFolder = getWorkspaceFolder()
  const parsed = await validateConfigSection(params.section, params.value, { cwd: workspaceFolder })
  if (!parsed.success) {
    throw badRequest(
      'Invalid config section value',
      {
        section: params.section,
        issues: parsed.error.issues.map(issue => ({
          path: issue.path,
          message: issue.message
        }))
      },
      'invalid_config_section_value'
    )
  }

  await updateConfigFile({
    workspaceFolder,
    source: params.source,
    section: params.section,
    value: parsed.data
  })

  const configState = await loadConfigState(workspaceFolder)
  await reloadChannels([configState.projectConfig, configState.userConfig])
  await startLocalMdpRootServer({
    workspaceFolder: configState.workspaceFolder,
    mergedConfig: configState.mergedConfig
  })
  await startServerMdpRuntime({
    workspaceFolder: configState.workspaceFolder,
    mergedConfig: configState.mergedConfig
  })

  return { ok: true }
}
