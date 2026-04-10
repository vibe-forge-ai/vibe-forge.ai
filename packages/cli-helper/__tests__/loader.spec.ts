import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, resolve } from 'node:path'
import process from 'node:process'

import { afterEach, describe, expect, it } from 'vitest'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('cli-helper loader wrapper', () => {
  it('propagates the spawned cli exit code', async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), 'vf-cli-helper-'))
    tempDirs.push(tempDir)

    const entryPath = resolve(tempDir, 'entry.js')
    await writeFile(entryPath, 'process.exit(Number(process.env.TEST_EXIT_CODE || "0"))\n')

    const result = spawnSync(
      process.execPath,
      [resolve(process.cwd(), 'packages/cli-helper/loader.js')],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          __VF_PROJECT_PACKAGE_DIR__: tempDir,
          __VF_PROJECT_CLI_BIN_SOURCE_ENTRY__: entryPath,
          TEST_EXIT_CODE: '7'
        },
        encoding: 'utf8'
      }
    )

    expect(result.status).toBe(7)
    expect(result.signal).toBeNull()
  })

  it('bootstraps cli package environment before delegating to the loader', async () => {
    const workspaceDir = await mkdtemp(resolve(tmpdir(), 'vf-cli-helper-entry-'))
    tempDirs.push(workspaceDir)

    const packageDir = resolve(workspaceDir, 'packages/fake-cli')
    await mkdir(packageDir, { recursive: true })
    const realWorkspaceDir = await realpath(workspaceDir)
    const entryPath = resolve(process.cwd(), 'packages/cli-helper/entry.js')
    const result = spawnSync(
      process.execPath,
      [
        '-e',
        `
const Module = require('node:module')
const entryPath = ${JSON.stringify(entryPath)}
const originalLoad = Module._load

Module._load = function(request, parent, isMain) {
  if (request === '@vibe-forge/register/dotenv') {
    return {}
  }

  if (request === './loader' && parent?.filename === entryPath) {
    process.stdout.write(JSON.stringify({
      workspaceFolder: process.env.__VF_PROJECT_WORKSPACE_FOLDER__,
      packageDir: process.env.__VF_PROJECT_PACKAGE_DIR__,
      realHome: process.env.__VF_PROJECT_REAL_HOME__,
      home: process.env.HOME,
      sourceEntry: process.env.__VF_PROJECT_CLI_BIN_SOURCE_ENTRY__,
      distEntry: process.env.__VF_PROJECT_CLI_BIN_DIST_ENTRY__
    }))
    return {}
  }

  return originalLoad.call(this, request, parent, isMain)
}

require(entryPath).runCliPackageEntrypoint({
  packageDir: ${JSON.stringify(packageDir)},
  sourceEntry: './src/custom-cli',
  distEntry: './dist/custom-cli.js'
})
      `
      ],
      {
        cwd: workspaceDir,
        env: {
          ...process.env,
          HOME: '/tmp/original-home'
        },
        encoding: 'utf8'
      }
    )

    expect(result.status).toBe(0)
    expect(result.signal).toBeNull()
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toEqual({
      workspaceFolder: realWorkspaceDir,
      packageDir,
      realHome: '/tmp/original-home',
      home: resolve(realWorkspaceDir, '.ai/.mock'),
      sourceEntry: './src/custom-cli',
      distEntry: './dist/custom-cli.js'
    })
  })

  it('bootstraps NODE_PATH from package resolution paths', async () => {
    const workspaceDir = await mkdtemp(resolve(tmpdir(), 'vf-cli-helper-node-path-'))
    tempDirs.push(workspaceDir)

    const packageDir = resolve(workspaceDir, 'vendor/fake-cli')
    const dependencyDir = resolve(workspaceDir, 'vendor/node_modules/dep')
    await mkdir(packageDir, { recursive: true })
    await mkdir(dependencyDir, { recursive: true })
    await writeFile(resolve(dependencyDir, 'package.json'), JSON.stringify({ name: 'dep', version: '1.0.0' }))
    const resolvedDependencyPackageJson = await realpath(resolve(dependencyDir, 'package.json'))
    const resolvedVendorNodeModules = await realpath(resolve(workspaceDir, 'vendor/node_modules'))

    const entryPath = resolve(packageDir, 'entry.js')
    await writeFile(
      entryPath,
      `const { createRequire } = require('node:module')
const { resolve } = require('node:path')
const workspaceRequire = createRequire(resolve(process.cwd(), '__workspace_probe__.cjs'))
process.stdout.write(JSON.stringify({
  nodePath: process.env.NODE_PATH,
  resolved: workspaceRequire.resolve('dep/package.json')
}))
`
    )

    const result = spawnSync(
      process.execPath,
      [resolve(process.cwd(), 'packages/cli-helper/loader.js')],
      {
        cwd: workspaceDir,
        env: {
          ...process.env,
          NODE_PATH: '',
          __VF_PROJECT_PACKAGE_DIR__: packageDir,
          __VF_PROJECT_CLI_BIN_SOURCE_ENTRY__: entryPath
        },
        encoding: 'utf8'
      }
    )

    expect(result.status).toBe(0)
    expect(result.signal).toBeNull()
    expect(result.stderr).toBe('')

    const output = JSON.parse(result.stdout) as { nodePath: string; resolved: string }
    const normalizedNodePathEntries = await Promise.all(
      output.nodePath
        .split(delimiter)
        .filter(Boolean)
        .map(async entry => {
          try {
            return await realpath(entry)
          } catch {
            return entry
          }
        })
    )
    expect(output.resolved).toBe(resolvedDependencyPackageJson)
    expect(normalizedNodePathEntries).toContain(resolvedVendorNodeModules)
  })
})
