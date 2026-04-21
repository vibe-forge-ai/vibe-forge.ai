import process from 'node:process'

import Router from '@koa/router'

import {
  composeBaseConfigSchemaBundle,
  composeWorkspaceConfigSchemaBundle,
  resolveWritableConfigPath,
  updateConfigFile,
  validateConfigSection,
  writeWorkspaceConfigSchemaFile
} from '@vibe-forge/config'
import type { ConfigSchemaResponse } from '@vibe-forge/types'
import { resolveProjectAiBaseDirName } from '@vibe-forge/utils'

import { getWorkspaceFolder, loadConfigState } from '#~/services/config/index.js'
import { badRequest, internalServerError, isHttpError } from '#~/utils/http.js'

import { buildConfigAbout, buildSections, loadAdapterBuiltinModels } from './config-helpers.js'

export function configRouter(): Router {
  const router = new Router()

  router.get('/schema', async (ctx) => {
    try {
      const workspaceFolder = getWorkspaceFolder()
      const [base, workspace] = await Promise.all([
        Promise.resolve(composeBaseConfigSchemaBundle()),
        composeWorkspaceConfigSchemaBundle({ cwd: workspaceFolder })
      ])

      const body: ConfigSchemaResponse = {
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

      ctx.body = body
    } catch (err) {
      throw internalServerError('Failed to load config schema', { cause: err, code: 'config_schema_load_failed' })
    }
  })

  router.post('/schema/generate', async (ctx) => {
    try {
      const workspaceFolder = getWorkspaceFolder()
      const { outputPath, bundle } = await writeWorkspaceConfigSchemaFile({ cwd: workspaceFolder })
      ctx.body = {
        ok: true,
        outputPath,
        extensions: bundle.extensions
      }
    } catch (err) {
      throw internalServerError('Failed to generate config schema', {
        cause: err,
        code: 'config_schema_generate_failed'
      })
    }
  })

  router.get('/', async (ctx) => {
    try {
      const {
        workspaceFolder,
        mergedConfig,
        projectSource,
        userSource
      } = await loadConfigState()
      const mergedSections = buildSections(mergedConfig)
      mergedSections.general.baseDir = process.env.__VF_PROJECT_AI_BASE_DIR__ != null
        ? resolveProjectAiBaseDirName(process.env)
        : mergedConfig.baseDir ?? resolveProjectAiBaseDirName(process.env)
      mergedSections.adapterBuiltinModels = loadAdapterBuiltinModels(mergedConfig.adapters)
      const about = await buildConfigAbout()
      ctx.body = {
        sources: {
          project: buildSections(projectSource?.rawConfig),
          user: buildSections(userSource?.rawConfig),
          merged: mergedSections
        },
        resolvedSources: {
          project: buildSections(projectSource?.resolvedConfig),
          user: buildSections(userSource?.resolvedConfig)
        },
        meta: {
          workspaceFolder,
          configPresent: {
            project: projectSource?.configPath != null,
            user: userSource?.configPath != null
          },
          sourceFiles: {
            project: {
              configPath: projectSource?.configPath,
              writableConfigPath: resolveWritableConfigPath(workspaceFolder, 'project'),
              extendPaths: projectSource?.extendPaths ?? []
            },
            user: {
              configPath: userSource?.configPath,
              writableConfigPath: resolveWritableConfigPath(workspaceFolder, 'user'),
              extendPaths: userSource?.extendPaths ?? []
            }
          },
          experiments: {},
          about
        }
      }
    } catch (err) {
      throw internalServerError('Failed to load config', { cause: err, code: 'config_load_failed' })
    }
  })

  router.patch('/', async (ctx) => {
    const { source, section, value } = ctx.request.body as {
      source?: 'project' | 'user'
      section?: string
      value?: unknown
    }

    if (source !== 'project' && source !== 'user') {
      throw badRequest('Invalid source', { source }, 'invalid_source')
    }

    if (section == null || typeof section !== 'string' || section.trim() === '') {
      throw badRequest('Invalid section', { section }, 'invalid_section')
    }

    try {
      const workspaceFolder = getWorkspaceFolder()
      const parsed = await validateConfigSection(section, value, { cwd: workspaceFolder })
      if (!parsed.success) {
        throw badRequest(
          'Invalid config section value',
          {
            section,
            issues: parsed.error.issues.map(issue => ({
              path: issue.path,
              message: issue.message
            }))
          },
          'invalid_config_section_value'
        )
      }
      await updateConfigFile({ workspaceFolder, source, section, value: parsed.data })
      ctx.body = { ok: true }
    } catch (err) {
      if (isHttpError(err)) {
        throw err
      }
      throw internalServerError('Failed to update config', { cause: err, code: 'config_update_failed' })
    }
  })

  return router
}
