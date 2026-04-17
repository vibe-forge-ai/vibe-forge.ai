import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ConfigUiSection } from '@vibe-forge/types'

import { SectionForm } from '#~/components/config/ConfigSectionForm'
import { parseConfigDetailRoute, serializeConfigDetailRoute } from '#~/components/config/configDetail'
import { configSchema } from '#~/components/config/configSchema'

const t = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key

describe('config schema form', () => {
  it('renders schema-driven adapter entries with JSON fallback for unknown keys', () => {
    const uiSection: ConfigUiSection = {
      key: 'adapters',
      kind: 'recordMap',
      recordMap: {
        mode: 'keyed',
        keyPlaceholder: 'Adapter key',
        schemas: {
          codex: {
            fields: [
              {
                path: ['experimentalApi'],
                type: 'boolean',
                label: 'Experimental API',
                defaultValue: false
              },
              {
                path: ['maxOutputTokens'],
                type: 'number',
                label: 'Max Output Tokens',
                defaultValue: 4096
              }
            ]
          }
        },
        unknownSchema: {
          fields: [
            {
              path: ['defaultModel'],
              type: 'string',
              label: 'Default Model',
              defaultValue: ''
            }
          ]
        },
        unknownEditor: 'json'
      }
    }

    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='adapters'
        uiSection={uiSection}
        value={{
          codex: {
            experimentalApi: true,
            maxOutputTokens: 2048
          },
          'custom-adapter': {
            defaultModel: 'gpt-5.4'
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        t={t}
      />
    )

    expect(html).toContain('Experimental API')
    expect(html).toContain('Max Output Tokens')
    expect(html).toContain('custom-adapter')
    expect(html).toContain('config-view__complex-editor')
  })

  it('renders schema-driven channel entries from the server-provided schema', () => {
    const uiSection: ConfigUiSection = {
      key: 'channels',
      kind: 'recordMap',
      recordMap: {
        mode: 'discriminated',
        keyPlaceholder: 'Channel name',
        discriminatorField: 'type',
        entryKinds: [
          {
            key: 'lark',
            label: 'Lark'
          }
        ],
        schemas: {
          lark: {
            fields: [
              {
                path: ['type'],
                type: 'select',
                options: [{ value: 'lark' }],
                defaultValue: 'lark'
              },
              {
                path: ['appId'],
                type: 'string',
                label: 'App ID',
                defaultValue: ''
              },
              {
                path: ['appSecret'],
                type: 'string',
                label: 'App Secret',
                defaultValue: ''
              }
            ]
          }
        },
        unknownSchema: {
          fields: []
        },
        unknownEditor: 'json'
      }
    }

    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='channels'
        uiSection={uiSection}
        value={{
          teamChat: {
            type: 'lark',
            appId: 'cli_123',
            appSecret: 'secret'
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        t={t}
      />
    )

    expect(html).toContain('teamChat')
    expect(html).toContain('App ID')
    expect(html).toContain('App Secret')
  })

  it('renders unknown channel entries with the JSON fallback editor', () => {
    const uiSection: ConfigUiSection = {
      key: 'channels',
      kind: 'recordMap',
      recordMap: {
        mode: 'discriminated',
        keyPlaceholder: 'Channel name',
        discriminatorField: 'type',
        entryKinds: [
          {
            key: 'lark',
            label: 'Lark'
          }
        ],
        schemas: {
          lark: {
            fields: [
              {
                path: ['type'],
                type: 'select',
                options: [{ value: 'lark' }],
                defaultValue: 'lark'
              },
              {
                path: ['appId'],
                type: 'string',
                label: 'App ID',
                defaultValue: ''
              }
            ]
          }
        },
        unknownSchema: {
          fields: []
        },
        unknownEditor: 'json'
      }
    }

    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='channels'
        uiSection={uiSection}
        value={{
          customChat: {
            type: 'custom-channel',
            customFlag: true
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        t={t}
      />
    )

    expect(html).toContain('customChat')
    expect(html).toContain('config-view__complex-editor')
    expect(html).not.toContain('App ID')
  })

  it('falls back to the JSON record editor when no channel kinds are available', () => {
    const uiSection: ConfigUiSection = {
      key: 'channels',
      kind: 'recordMap',
      recordMap: {
        mode: 'discriminated',
        keyPlaceholder: 'Channel name',
        discriminatorField: 'type',
        entryKinds: [],
        schemas: {},
        unknownSchema: {
          fields: []
        },
        unknownEditor: 'json'
      }
    }

    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='channels'
        uiSection={uiSection}
        value={{
          teamChat: {
            type: 'custom-channel',
            customFlag: true
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        t={t}
      />
    )

    expect(html).toContain('teamChat')
    expect(html).not.toContain('ant-select')
  })

  it('renders detail-list fields as a navigable summary list', () => {
    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='general'
        value={{
          recommendedModels: [
            {
              service: 'gpt-responses',
              model: 'gpt-5.4',
              title: 'Fast Default',
              description: 'Recommended for daily work',
              placement: 'modelSelector'
            }
          ]
        }}
        onChange={() => undefined}
        mergedModelServices={{
          'gpt-responses': {
            title: 'GPT Responses',
            models: ['gpt-5.4']
          }
        }}
        mergedAdapters={{}}
        t={t}
      />
    )

    expect(html).toContain('Fast Default')
    expect(html).toContain('Recommended for daily work')
    expect(html).toContain('config-view__detail-list')
  })

  it('renders a detail-list item route as a second-level config page', () => {
    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='general'
        value={{
          recommendedModels: [
            {
              service: 'gpt-responses',
              model: 'gpt-5.4',
              title: 'Fast Default',
              description: 'Recommended for daily work',
              placement: 'modelSelector'
            }
          ]
        }}
        onChange={() => undefined}
        mergedModelServices={{
          'gpt-responses': {
            title: 'GPT Responses',
            models: ['gpt-5.4']
          }
        }}
        mergedAdapters={{}}
        detailRoute={{
          kind: 'detailListItem',
          fieldPath: ['recommendedModels'],
          itemIndex: 0
        }}
        t={t}
      />
    )

    expect(html).toContain('config.fields.general.recommendedModels.item.model.label')
    expect(html).toContain('config.fields.general.recommendedModels.item.description.label')
    expect(html).not.toContain('config-view__detail-list')
  })

  it('serializes detail-list routes into query-friendly paths', () => {
    const route = {
      kind: 'detailListItem' as const,
      fieldPath: ['recommendedModels'],
      itemIndex: 2
    }

    const raw = serializeConfigDetailRoute(route)

    expect(raw).toBe('recommendedModels/2')
    expect(parseConfigDetailRoute({ fields: configSchema.general, raw })).toEqual(route)
  })
})
