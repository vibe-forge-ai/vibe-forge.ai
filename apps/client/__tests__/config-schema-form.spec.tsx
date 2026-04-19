/* eslint-disable max-lines -- config form coverage is intentionally consolidated in one spec file */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ConfigUiSection } from '@vibe-forge/types'

import { SectionForm } from '#~/components/config/ConfigSectionForm'
import { parseConfigDetailRoute, serializeConfigDetailRoute } from '#~/components/config/configDetail'
import { configSchema } from '#~/components/config/configSchema'

const t = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key

describe('config schema form', () => {
  it('renders schema-driven adapter entries as a navigable summary list', () => {
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

    expect(html).toContain('custom-adapter')
    expect(html).toContain('config-view__detail-list')
  })

  it('renders a schema-driven adapter detail route as a second-level config page', () => {
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
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        detailRoute={{
          kind: 'detailCollectionItem',
          fieldPath: [],
          itemKey: 'codex'
        }}
        t={t}
      />
    )

    expect(html).toContain('Experimental API')
    expect(html).toContain('Max Output Tokens')
    expect(html).not.toContain('config-view__detail-list')
  })

  it('renders schema-driven channel entries as a navigable summary list', () => {
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
    expect(html).toContain('config-view__detail-list')
  })

  it('renders a schema-driven channel detail route as a second-level config page', () => {
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
        detailRoute={{
          kind: 'detailCollectionItem',
          fieldPath: [],
          itemKey: 'teamChat'
        }}
        t={t}
      />
    )

    expect(html).toContain('App ID')
    expect(html).toContain('App Secret')
    expect(html).not.toContain('config-view__detail-list')
  })

  it('renders unknown channel detail routes with the JSON fallback editor', () => {
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
          customChat: {
            type: 'custom-channel',
            customFlag: true
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        detailRoute={{
          kind: 'detailCollectionItem',
          fieldPath: [],
          itemKey: 'customChat'
        }}
        t={t}
      />
    )

    expect(html).toContain('config-view__complex-editor')
    expect(html).not.toContain('App ID')
  })

  it('renders detail-collection list fields as a navigable summary list', () => {
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

  it('renders a detail-collection list item route as a second-level config page', () => {
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
          kind: 'detailCollectionItem',
          fieldPath: ['recommendedModels'],
          itemKey: '0'
        }}
        t={t}
      />
    )

    expect(html).toContain('config.fields.general.recommendedModels.item.model.label')
    expect(html).toContain('config.fields.general.recommendedModels.item.description.label')
    expect(html).not.toContain('config-view__detail-list')
  })

  it('renders detail-collection record fields as a navigable summary list', () => {
    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='general'
        value={{
          notifications: {
            events: {
              completed: {
                title: 'All done',
                sound: '/tmp/done.mp3'
              }
            }
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        t={t}
      />
    )

    expect(html).toContain('completed')
    expect(html).toContain('All done')
    expect(html).toContain('config-view__detail-list')
  })

  it('renders a detail-collection record item route as a second-level config page', () => {
    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='general'
        value={{
          notifications: {
            events: {
              completed: {
                title: 'All done',
                description: 'Done description',
                sound: '/tmp/done.mp3'
              }
            }
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        detailRoute={{
          kind: 'detailCollectionItem',
          fieldPath: ['notifications', 'events'],
          itemKey: 'completed'
        }}
        t={t}
      />
    )

    expect(html).toContain('config.fields.general.notifications.events.item.title.label')
    expect(html).toContain('config.fields.general.notifications.events.item.description.label')
    expect(html).not.toContain('config-view__detail-list')
  })

  it('renders model service detail collections as second-level config pages', () => {
    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='modelServices'
        value={{
          openai: {
            title: 'OpenAI',
            description: 'Primary service',
            apiBaseUrl: 'https://api.openai.com/v1',
            apiKey: 'secret',
            models: ['gpt-5.4']
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        detailRoute={{
          kind: 'detailCollectionItem',
          fieldPath: [],
          itemKey: 'openai'
        }}
        t={t}
      />
    )

    expect(html).toContain('config.fields.modelServices.item.apiBaseUrl.label')
    expect(html).toContain('config.fields.modelServices.item.models.label')
  })

  it('renders inherited detail-collection entries as readonly summaries in source views', () => {
    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='modelServices'
        value={{}}
        resolvedValue={{
          openai: {
            title: 'OpenAI',
            description: 'Inherited service'
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        t={t}
      />
    )

    expect(html).toContain('OpenAI')
    expect(html).toContain('config.detail.inheritedBadge')
  })

  it('renders inherited detail routes as readonly pages with an explicit override action', () => {
    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='modelServices'
        value={{}}
        resolvedValue={{
          openai: {
            title: 'OpenAI',
            description: 'Inherited service',
            apiBaseUrl: 'https://api.openai.com/v1'
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        detailRoute={{
          kind: 'detailCollectionItem',
          fieldPath: [],
          itemKey: 'openai'
        }}
        t={t}
      />
    )

    expect(html).toContain('config.detail.inheritedReadonly')
    expect(html).toContain('config.detail.override')
    expect(html).toContain('config.fields.modelServices.item.apiBaseUrl.label')
  })

  it('renders local detail overrides with inherited field context', () => {
    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='modelServices'
        value={{
          openai: {
            apiBaseUrl: 'https://proxy.internal/v1'
          }
        }}
        resolvedValue={{
          openai: {
            title: 'OpenAI',
            description: 'Inherited service',
            apiBaseUrl: 'https://proxy.internal/v1'
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        detailRoute={{
          kind: 'detailCollectionItem',
          fieldPath: [],
          itemKey: 'openai'
        }}
        t={t}
      />
    )

    expect(html).toContain('config.detail.partialOverride')
    expect(html).toContain('config.fields.modelServices.item.title.label')
    expect(html).toContain('config.fields.modelServices.item.description.label')
  })

  it('renders mcp server detail collections as second-level config pages', () => {
    const html = renderToStaticMarkup(
      <SectionForm
        sectionKey='mcp'
        value={{
          mcpServers: {
            filesystem: {
              enabled: true,
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem']
            }
          }
        }}
        onChange={() => undefined}
        mergedModelServices={{}}
        mergedAdapters={{}}
        detailRoute={{
          kind: 'detailCollectionItem',
          fieldPath: ['mcpServers'],
          itemKey: 'filesystem'
        }}
        t={t}
      />
    )

    expect(html).toContain('config.fields.mcpServer.command.label')
    expect(html).toContain('config.fields.mcpServer.args.label')
  })

  it('serializes detail-collection routes into query-friendly paths', () => {
    const route = {
      kind: 'detailCollectionItem' as const,
      fieldPath: ['recommendedModels'],
      itemKey: '2'
    }

    const raw = serializeConfigDetailRoute(route)

    expect(raw).toBe('recommendedModels/2')
    expect(parseConfigDetailRoute({ fields: configSchema.general, raw })).toEqual(route)
  })

  it('serializes object-backed detail-collection routes into query-friendly paths', () => {
    const route = {
      kind: 'detailCollectionItem' as const,
      fieldPath: ['notifications', 'events'],
      itemKey: 'completed'
    }

    const raw = serializeConfigDetailRoute(route)

    expect(raw).toBe('notifications/events/completed')
    expect(parseConfigDetailRoute({ fields: configSchema.general, raw })).toEqual(route)
  })

  it('serializes root detail-collection routes into query-friendly paths', () => {
    const route = {
      kind: 'detailCollectionItem' as const,
      fieldPath: [],
      itemKey: 'codex'
    }

    const raw = serializeConfigDetailRoute(route)

    expect(raw).toBe('codex')
    expect(parseConfigDetailRoute({ fields: configSchema.adapters, raw })).toEqual(route)
  })
})
