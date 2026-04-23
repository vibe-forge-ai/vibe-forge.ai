import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveConfiguredPluginInstances, resolvePluginHooksEntryPathForInstance } from '#~/plugin-resolver.js'

const tempDirs: string[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('plugin resolver', () => {
  it('resolves plugins from the runtime package dir when the workspace does not install them', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'vf-plugin-resolver-'))
    tempDirs.push(tempDir)

    const workspace = join(tempDir, 'workspace')
    const packageDir = join(tempDir, 'runtime-package')
    const pluginRoot = join(packageDir, 'node_modules/@vibe-forge/plugin-logger')
    await mkdir(join(pluginRoot, 'dist'), { recursive: true })
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: '@acme/runtime' }, null, 2))
    await writeFile(
      join(pluginRoot, 'package.json'),
      JSON.stringify(
        {
          name: '@vibe-forge/plugin-logger',
          version: '1.0.0',
          exports: {
            '.': './dist/index.js',
            './hooks': './dist/hooks.js',
            './package.json': './package.json'
          }
        },
        null,
        2
      )
    )
    await writeFile(
      join(pluginRoot, 'dist/index.js'),
      'module.exports = { __vibeForgePluginManifest: true }\n'
    )
    await writeFile(join(pluginRoot, 'dist/hooks.js'), 'module.exports = {}\n')

    vi.stubEnv('__VF_PROJECT_PACKAGE_DIR__', packageDir)

    const [instance] = await resolveConfiguredPluginInstances({
      cwd: workspace,
      plugins: [{ id: 'logger' }]
    })

    expect(instance).toMatchObject({
      requestId: 'logger',
      packageId: '@vibe-forge/plugin-logger',
      rootDir: pluginRoot,
      resolvedBy: 'vibe-forge-prefix'
    })
    expect(resolvePluginHooksEntryPathForInstance(workspace, instance!)).toContain(
      'runtime-package/node_modules/@vibe-forge/plugin-logger/dist/hooks.js'
    )
  })
})
