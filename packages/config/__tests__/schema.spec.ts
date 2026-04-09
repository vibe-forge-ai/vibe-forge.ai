import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  composeBaseConfigSchemaBundle,
  composeWorkspaceConfigSchemaBundle,
  validateConfigSection,
  writeWorkspaceConfigSchemaFile
} from '#~/schema.js'

describe('config schema bundle', () => {
  it('keeps the base schema adapter slot generic', () => {
    const bundle = composeBaseConfigSchemaBundle()
    const adapters = (bundle.jsonSchema.properties as Record<string, unknown>).adapters as Record<string, unknown>

    expect(bundle.extensions.adapters).toEqual([])
    expect(adapters).toMatchObject({
      type: 'object',
      properties: {}
    })
    expect((adapters.additionalProperties as Record<string, unknown>).properties).toMatchObject({
      defaultModel: { type: 'string' },
      includeModels: { type: 'array' },
      excludeModels: { type: 'array' }
    })
  })

  it('composes workspace adapter and channel contributions from installed packages', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-schema-'))

    try {
      await writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'schema-test-workspace',
          private: true,
          dependencies: {
            '@vibe-forge/adapter-codex': 'workspace:*',
            '@vibe-forge/channel-lark': 'workspace:*'
          }
        }, null, 2)
      )

      const bundle = await composeWorkspaceConfigSchemaBundle({ cwd: tempDir })
      const adapters = (bundle.jsonSchema.properties as Record<string, unknown>).adapters as Record<string, unknown>
      const adapterProperties = adapters.properties as Record<string, unknown>
      const codexSchema = adapterProperties.codex as Record<string, unknown>
      const channels = (bundle.uiSchema.sections.channels.recordMap.schemas.lark?.fields ?? [])
        .map(field => field.path.join('.'))

      expect(bundle.extensions.adapters).toContain('codex')
      expect(bundle.extensions.channels).toContain('lark')
      expect(codexSchema.properties).toMatchObject({
        sandboxPolicy: { type: 'object' },
        experimentalApi: { type: 'boolean' }
      })
      expect(channels).toContain('appId')
      expect(channels).toContain('appSecret')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('validates known adapter fields while keeping unknown adapters permissive', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-schema-'))

    try {
      await writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'schema-test-workspace',
          private: true,
          dependencies: {
            '@vibe-forge/adapter-codex': 'workspace:*'
          }
        }, null, 2)
      )

      const knownValid = await validateConfigSection('adapters', {
        codex: {
          sandboxPolicy: {
            type: 'workspaceWrite'
          }
        }
      }, { cwd: tempDir })

      const knownInvalid = await validateConfigSection('adapters', {
        codex: {
          sandboxPolicy: {
            type: 'not-a-real-mode'
          }
        }
      }, { cwd: tempDir })

      const unknownAdapter = await validateConfigSection('adapters', {
        'custom-adapter': {
          defaultModel: 'gpt-5.4',
          customFlag: true
        }
      }, { cwd: tempDir })

      expect(knownValid.success).toBe(true)
      expect(knownInvalid.success).toBe(false)
      expect(unknownAdapter.success).toBe(true)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('writes the workspace composite schema to .ai/schema/config.schema.json', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-schema-'))

    try {
      await writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'schema-test-workspace',
          private: true,
          dependencies: {
            '@vibe-forge/adapter-codex': 'workspace:*'
          }
        }, null, 2)
      )

      const { outputPath } = await writeWorkspaceConfigSchemaFile({ cwd: tempDir })
      const written = JSON.parse(await readFile(outputPath, 'utf8')) as Record<string, unknown>

      expect(outputPath).toBe(path.join(tempDir, '.ai/schema/config.schema.json'))
      expect(written.$schema).toBe('http://json-schema.org/draft-07/schema#')
      expect((written.properties as Record<string, unknown>).adapters).toBeDefined()
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
