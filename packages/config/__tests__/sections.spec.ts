import { describe, expect, it } from 'vitest'

import {
  getConfigSectionValueAtPath,
  setConfigSectionValueAtPath,
  unsetConfigSectionValueAtPath
} from '#~/section-path-value.js'
import { parseConfigSectionPath, resolveConfigSectionPath } from '#~/section-path.js'
import { buildConfigSections, hasConfigSectionValue } from '#~/sections.js'

describe('config sections helpers', () => {
  it('maps root config aliases onto section paths', () => {
    expect(resolveConfigSectionPath(parseConfigSectionPath('defaultModel'))).toEqual({
      input: ['defaultModel'],
      normalizedPath: 'general.defaultModel',
      section: 'general',
      sectionPath: ['defaultModel']
    })

    expect(resolveConfigSectionPath(parseConfigSectionPath('mcpServers.docs.args.0'))).toEqual({
      input: ['mcpServers', 'docs', 'args', 0],
      normalizedPath: 'mcp.mcpServers.docs.args.0',
      section: 'mcp',
      sectionPath: ['mcpServers', 'docs', 'args', 0]
    })

    expect(resolveConfigSectionPath(parseConfigSectionPath('skills.0.rename'))).toEqual({
      input: ['skills', 0, 'rename'],
      normalizedPath: 'general.skills.0.rename',
      section: 'general',
      sectionPath: ['skills', 0, 'rename']
    })
  })

  it('supports plugin list aliases and exact JSON-array paths', () => {
    expect(resolveConfigSectionPath(parseConfigSectionPath('plugins.0.id'))).toEqual({
      input: ['plugins', 0, 'id'],
      normalizedPath: 'plugins.plugins.0.id',
      section: 'plugins',
      sectionPath: ['plugins', 0, 'id']
    })

    expect(resolveConfigSectionPath(parseConfigSectionPath('["models","gpt-4.1","title"]'))).toEqual({
      input: ['models', 'gpt-4.1', 'title'],
      normalizedPath: 'models.gpt-4.1.title',
      section: 'models',
      sectionPath: ['gpt-4.1', 'title']
    })
  })

  it('reads and updates nested section values', () => {
    const sections = buildConfigSections({
      defaultModel: 'gpt-5',
      models: {
        'gpt-4.1': {
          title: 'GPT 4.1'
        }
      },
      plugins: [
        {
          id: 'demo'
        }
      ]
    })

    const modelTitlePath = resolveConfigSectionPath(parseConfigSectionPath('["models","gpt-4.1","title"]'))
    expect(getConfigSectionValueAtPath(sections, modelTitlePath)).toEqual({
      exists: true,
      value: 'GPT 4.1'
    })

    const pluginEnabledPath = resolveConfigSectionPath(parseConfigSectionPath('plugins.0.enabled'))
    const updatedSections = setConfigSectionValueAtPath(sections, pluginEnabledPath, true)
    expect(getConfigSectionValueAtPath(updatedSections, pluginEnabledPath)).toEqual({
      exists: true,
      value: true
    })
  })

  it('marks object keys as undefined and splices array items when unsetting', () => {
    const sections = buildConfigSections({
      permissions: {
        allow: ['Read'],
        deny: ['Write']
      },
      plugins: [
        {
          id: 'demo'
        },
        {
          id: 'extra'
        }
      ]
    })

    const permissionsPath = resolveConfigSectionPath(parseConfigSectionPath('general.permissions.allow'))
    const nextPermissionsSections = unsetConfigSectionValueAtPath(sections, permissionsPath)
    expect(nextPermissionsSections.general.permissions).toEqual({
      allow: undefined,
      deny: ['Write']
    })

    const pluginPath = resolveConfigSectionPath(parseConfigSectionPath('plugins.0'))
    const nextPluginSections = unsetConfigSectionValueAtPath(sections, pluginPath)
    expect(nextPluginSections.plugins.plugins).toEqual([
      {
        id: 'extra'
      }
    ])
  })

  it('detects whether a section has meaningful configured values', () => {
    const emptySections = buildConfigSections(undefined)
    expect(hasConfigSectionValue(emptySections.general)).toBe(false)
    expect(hasConfigSectionValue(emptySections.adapters)).toBe(false)

    const configuredSections = buildConfigSections({
      permissions: {
        allow: ['Read']
      }
    })
    expect(hasConfigSectionValue(configuredSections.general)).toBe(true)
  })
})
