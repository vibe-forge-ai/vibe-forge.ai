import { describe, expect, it, vi } from 'vitest'

const {
  loadConfigStateMock,
  loadAdapterManifestMock,
  resolveAdapterPackageNameForConfigEntryMock
} = vi.hoisted(() => ({
  loadConfigStateMock: vi.fn(),
  loadAdapterManifestMock: vi.fn(),
  resolveAdapterPackageNameForConfigEntryMock: vi.fn()
}))

vi.mock('#~/services/config/index.js', () => ({
  loadConfigState: loadConfigStateMock
}))

vi.mock('@vibe-forge/types', async () => {
  const actual = await vi.importActual<typeof import('@vibe-forge/types')>('@vibe-forge/types')
  return {
    ...actual,
    loadAdapterManifest: loadAdapterManifestMock,
    resolveAdapterPackageNameForConfigEntry: resolveAdapterPackageNameForConfigEntryMock
  }
})

import { loadAdapterCatalog } from '#~/services/config/adapter-catalog.js'

describe('loadAdapterCatalog', () => {
  it('builds sorted adapter entries from instance-keyed config', async () => {
    loadConfigStateMock.mockResolvedValue({
      mergedConfig: {
        adapters: {
          review: {
            packageId: '@acme/vf-adapter-review'
          },
          primary: {
            packageId: '@vibe-forge/adapter-codex'
          }
        }
      }
    })

    loadAdapterManifestMock.mockImplementation((instanceId: string) => ({
      packageId: instanceId === 'primary'
        ? '@vibe-forge/adapter-codex'
        : '@acme/vf-adapter-review',
      title: instanceId === 'primary' ? 'Codex' : 'Review',
      builtinModels: instanceId === 'primary'
        ? [{ value: 'gpt-5.4', title: 'GPT-5.4', description: 'Primary model' }]
        : [{ value: 'review-v1', title: 'Review V1', description: 'Review model' }],
      capabilities: {
        supportsEffort: instanceId === 'primary'
      }
    }))

    resolveAdapterPackageNameForConfigEntryMock.mockImplementation((instanceId: string, config?: { packageId?: string }) => (
      config?.packageId ?? instanceId
    ))

    await expect(loadAdapterCatalog()).resolves.toEqual({
      adapters: [
        {
          instanceId: 'primary',
          packageId: '@vibe-forge/adapter-codex',
          title: 'Codex',
          icon: undefined,
          builtinModels: [{ value: 'gpt-5.4', title: 'GPT-5.4', description: 'Primary model' }],
          capabilities: { supportsEffort: true }
        },
        {
          instanceId: 'review',
          packageId: '@acme/vf-adapter-review',
          title: 'Review',
          icon: undefined,
          builtinModels: [{ value: 'review-v1', title: 'Review V1', description: 'Review model' }],
          capabilities: { supportsEffort: false }
        }
      ]
    })
  })
})
