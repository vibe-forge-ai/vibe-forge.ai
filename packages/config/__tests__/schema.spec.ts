/* eslint-disable max-lines -- schema fixture coverage stays in one place */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  composeBaseConfigSchemaBundle,
  composeWorkspaceConfigSchemaBundle,
  validateConfigSection,
  writeWorkspaceConfigSchemaFile
} from '#~/schema.js'

const testRequire = createRequire(import.meta.url)
const zodPath = testRequire.resolve('zod')
const zodUrl = pathToFileURL(zodPath).href

const writePackage = async (
  workspaceDir: string,
  packageName: string,
  files: Record<string, string>,
  exportsMap: Record<string, unknown>
) => {
  const packageDir = path.join(workspaceDir, 'node_modules', ...packageName.split('/'))
  await mkdir(packageDir, { recursive: true })
  await writeFile(
    path.join(packageDir, 'package.json'),
    JSON.stringify({
      name: packageName,
      private: true,
      exports: exportsMap
    }, null, 2)
  )

  await Promise.all(Object.entries(files).map(async ([fileName, content]) => {
    const filePath = path.join(packageDir, fileName)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
  }))
}

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
        model: { type: 'string' },
        sandboxPolicy: { type: 'object' },
        experimentalApi: { type: 'boolean' },
        effort: { type: 'string' }
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

      const knownWithUnknownKey = await validateConfigSection('adapters', {
        codex: {
          sandboxPolicy: {
            type: 'workspaceWrite'
          },
          customFlag: true
        }
      }, { cwd: tempDir })

      expect(knownValid.success).toBe(true)
      expect(knownInvalid.success).toBe(false)
      expect(knownWithUnknownKey.success).toBe(false)
      expect(unknownAdapter.success).toBe(true)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('preserves the legacy model alias for known adapters', async () => {
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

      const parsed = await validateConfigSection('adapters', {
        codex: {
          model: 'gpt-5.4'
        }
      }, { cwd: tempDir })

      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data).toEqual({
          codex: {
            model: 'gpt-5.4'
          }
        })
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('rejects malformed known channels while keeping unknown channel types permissive', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-schema-'))

    try {
      await writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'schema-test-workspace',
          private: true,
          dependencies: {
            '@vibe-forge/channel-lark': 'workspace:*'
          }
        }, null, 2)
      )

      const knownInvalid = await validateConfigSection('channels', {
        teamChat: {
          type: 'lark'
        }
      }, { cwd: tempDir })

      const unknownChannel = await validateConfigSection('channels', {
        customChannel: {
          type: 'custom-channel',
          customFlag: true
        }
      }, { cwd: tempDir })

      const knownWithUnknownKey = await validateConfigSection('channels', {
        teamChat: {
          type: 'lark',
          appId: 'cli_123',
          appSecret: 'secret',
          customFlag: true
        }
      }, { cwd: tempDir })

      expect(knownInvalid.success).toBe(false)
      expect(knownInvalid.success ? [] : knownInvalid.error.issues.map(issue => issue.path.join('.'))).toEqual(
        expect.arrayContaining(['teamChat.appId', 'teamChat.appSecret'])
      )
      expect(knownWithUnknownKey.success).toBe(false)
      expect(knownWithUnknownKey.success ? [] : knownWithUnknownKey.error.issues.map(issue => issue.path.join('.'))).toContain(
        'teamChat'
      )
      expect(unknownChannel.success).toBe(true)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('loads contributions from workspace-local node_modules packages', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-schema-'))

    try {
      await writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'schema-test-workspace',
          private: true,
          dependencies: {
            '@scope/adapter-external': '1.0.0',
            '@scope/channel-external': '1.0.0'
          }
        }, null, 2)
      )

      await writePackage(tempDir, '@scope/adapter-external', {
        'config-schema.js': `
const { z } = require(${JSON.stringify(zodPath)})

module.exports.adapterConfigContribution = {
  adapterKey: 'external',
  title: 'External',
  schema: z.object({
    workspaceOnlyFlag: z.boolean().optional().describe('Workspace-only flag')
  })
}
`
      }, {
        './config-schema': './config-schema.js'
      })

      await writePackage(tempDir, '@scope/channel-external', {
        'index.js': `
const { z } = require(${JSON.stringify(zodPath)})

module.exports.channelDefinition = {
  type: 'external-channel',
  label: 'External Channel',
  configSchema: z.object({
    type: z.literal('external-channel'),
    workspaceToken: z.string().min(1).describe('Workspace token')
  }),
  messageSchema: z.object({})
}
`
      }, {
        '.': './index.js'
      })

      const bundle = await composeWorkspaceConfigSchemaBundle({ cwd: tempDir })
      const adapters = (bundle.jsonSchema.properties as Record<string, unknown>).adapters as Record<string, unknown>
      const adapterProperties = adapters.properties as Record<string, unknown>
      const externalSchema = adapterProperties['@scope/adapter-external'] as Record<string, unknown>
      const channelFields = bundle.uiSchema.sections.channels.recordMap.schemas['external-channel']?.fields ?? []

      expect(bundle.extensions.adapters).toContain('@scope/adapter-external')
      expect(bundle.extensions.channels).toContain('external-channel')
      expect(externalSchema.properties).toMatchObject({
        workspaceOnlyFlag: { type: 'boolean' }
      })
      expect(channelFields.map(field => field.path.join('.'))).toContain('workspaceToken')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('loads contributions from workspace-local ESM packages', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-schema-'))

    try {
      await writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'schema-test-workspace',
          private: true,
          dependencies: {
            '@scope/adapter-esm': '1.0.0',
            '@scope/channel-esm': '1.0.0'
          }
        }, null, 2)
      )

      await writePackage(tempDir, '@scope/adapter-esm', {
        'config-schema.mjs': `
import { z } from ${JSON.stringify(zodUrl)}

export const adapterConfigContribution = {
  adapterKey: 'esm-adapter',
  title: 'ESM Adapter',
  schema: z.object({
    esmFlag: z.boolean().optional().describe('ESM-only flag')
  })
}
`
      }, {
        './config-schema': {
          import: './config-schema.mjs'
        }
      })

      await writePackage(tempDir, '@scope/channel-esm', {
        'index.mjs': `
import { z } from ${JSON.stringify(zodUrl)}

export const channelDefinition = {
  type: 'esm-channel',
  label: 'ESM Channel',
  configSchema: z.object({
    type: z.literal('esm-channel'),
    channelToken: z.string().min(1).describe('Channel token')
  }),
  messageSchema: z.object({})
}
`
      }, {
        '.': {
          import: './index.mjs'
        }
      })

      const bundle = await composeWorkspaceConfigSchemaBundle({ cwd: tempDir })
      const adapters = (bundle.jsonSchema.properties as Record<string, unknown>).adapters as Record<string, unknown>
      const adapterProperties = adapters.properties as Record<string, unknown>
      const externalSchema = adapterProperties['@scope/adapter-esm'] as Record<string, unknown>
      const channelFields = bundle.uiSchema.sections.channels.recordMap.schemas['esm-channel']?.fields ?? []

      expect(bundle.extensions.adapters).toContain('@scope/adapter-esm')
      expect(bundle.extensions.channels).toContain('esm-channel')
      expect(externalSchema.properties).toMatchObject({
        esmFlag: { type: 'boolean' }
      })
      expect(channelFields.map(field => field.path.join('.'))).toContain('channelToken')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('loads adapter contributions from pattern exports', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-schema-'))

    try {
      await writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'schema-test-workspace',
          private: true,
          dependencies: {
            '@scope/adapter-pattern': '1.0.0'
          }
        }, null, 2)
      )

      await writePackage(tempDir, '@scope/adapter-pattern', {
        'dist/config-schema.mjs': `
import { z } from ${JSON.stringify(zodUrl)}

export const adapterConfigContribution = {
  adapterKey: 'pattern-adapter',
  title: 'Pattern Adapter',
  schema: z.object({
    patternFlag: z.boolean().optional().describe('Pattern export flag')
  })
}
`
      }, {
        './*': {
          import: './dist/*.mjs'
        }
      })

      const bundle = await composeWorkspaceConfigSchemaBundle({ cwd: tempDir })
      const adapters = (bundle.jsonSchema.properties as Record<string, unknown>).adapters as Record<string, unknown>
      const adapterProperties = adapters.properties as Record<string, unknown>
      const patternSchema = adapterProperties['@scope/adapter-pattern'] as Record<string, unknown>

      expect(bundle.extensions.adapters).toContain('@scope/adapter-pattern')
      expect(patternSchema.properties).toMatchObject({
        patternFlag: { type: 'boolean' }
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('returns normalized known channel values from section parsing', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-schema-'))

    try {
      await writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'schema-test-workspace',
          private: true,
          dependencies: {
            '@scope/channel-normalized': '1.0.0'
          }
        }, null, 2)
      )

      await writePackage(tempDir, '@scope/channel-normalized', {
        'index.js': `
const { z } = require(${JSON.stringify(zodPath)})

module.exports.channelDefinition = {
  type: 'normalized-channel',
  label: 'Normalized Channel',
  configSchema: z.object({
    type: z.literal('normalized-channel'),
    channelToken: z.string().default('default-token')
  }),
  messageSchema: z.object({})
}
`
      }, {
        '.': './index.js'
      })

      const parsed = await validateConfigSection('channels', {
        teamChat: {
          type: 'normalized-channel'
        }
      }, { cwd: tempDir })

      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data).toEqual({
          teamChat: {
            type: 'normalized-channel',
            channelToken: 'default-token'
          }
        })
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('normalizes known channels with a single schema parse pass', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-config-schema-'))

    try {
      await writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'schema-test-workspace',
          private: true,
          dependencies: {
            '@scope/channel-transform-count': '1.0.0'
          }
        }, null, 2)
      )

      await writePackage(tempDir, '@scope/channel-transform-count', {
        'index.js': `
const { z } = require(${JSON.stringify(zodPath)})

let parseCount = 0

module.exports.channelDefinition = {
  type: 'counted-channel',
  label: 'Counted Channel',
  configSchema: z.object({
    type: z.literal('counted-channel')
  }).transform((value) => ({
    ...value,
    parseCount: ++parseCount
  })),
  messageSchema: z.object({})
}
`
      }, {
        '.': './index.js'
      })

      const parsed = await validateConfigSection('channels', {
        teamChat: {
          type: 'counted-channel'
        }
      }, { cwd: tempDir })

      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data).toEqual({
          teamChat: {
            type: 'counted-channel',
            parseCount: 1
          }
        })
      }
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
