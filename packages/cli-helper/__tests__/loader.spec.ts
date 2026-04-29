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

    const nestedCwd = resolve(workspaceDir, 'packages/demo/src')
    const packageDir = resolve(workspaceDir, 'packages/fake-cli')
    const realHome = await mkdtemp(resolve(tmpdir(), 'vf-cli-helper-real-home-'))
    tempDirs.push(realHome)
    await mkdir(nestedCwd, { recursive: true })
    await mkdir(packageDir, { recursive: true })
    await mkdir(resolve(realHome, '.config/git'), { recursive: true })
    await writeFile(resolve(workspaceDir, '.ai.config.json'), '{}\n')
    await writeFile(resolve(realHome, '.gitconfig'), '[user]\\n\\tname = real\\n')
    await writeFile(resolve(realHome, '.config/git/config'), '[alias]\\n\\tco = checkout\\n')
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
    return {
      resolveProjectWorkspaceFolder: () => ${JSON.stringify(realWorkspaceDir)},
      resolveProjectAiBaseDir: () => ${JSON.stringify(resolve(realWorkspaceDir, '.ai'))},
      resolveProjectMockHome: () => ${JSON.stringify(resolve(realWorkspaceDir, '.ai/.mock'))}
    }
  }

  if (request === './loader' && parent?.filename === entryPath) {
    const fs = require('node:fs')
    const path = require('node:path')
    process.stdout.write(JSON.stringify({
      workspaceFolder: process.env.__VF_PROJECT_WORKSPACE_FOLDER__,
      packageDir: process.env.__VF_PROJECT_PACKAGE_DIR__,
      realHome: process.env.__VF_PROJECT_REAL_HOME__,
      home: process.env.HOME,
      gitConfigLink: fs.readlinkSync(path.join(process.env.HOME, '.gitconfig')),
      gitConfigDirLink: fs.readlinkSync(path.join(process.env.HOME, '.config/git')),
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
        cwd: nestedCwd,
        env: {
          ...process.env,
          HOME: realHome
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
      realHome,
      home: resolve(realWorkspaceDir, '.ai/.mock'),
      gitConfigLink: resolve(realHome, '.gitconfig'),
      gitConfigDirLink: resolve(realHome, '.config/git'),
      sourceEntry: './src/custom-cli',
      distEntry: './dist/custom-cli.js'
    })
  })

  it('uses the ai base dir relative to the env file when linking mock-home git config', async () => {
    const workspaceDir = await mkdtemp(resolve(tmpdir(), 'vf-cli-helper-ai-base-'))
    const targetDir = resolve(workspaceDir, 'business_modules/Miniapp')
    const packageDir = resolve(workspaceDir, 'packages/fake-cli')
    const realHome = await mkdtemp(resolve(tmpdir(), 'vf-cli-helper-real-home-'))
    tempDirs.push(workspaceDir, realHome)

    await mkdir(targetDir, { recursive: true })
    await mkdir(packageDir, { recursive: true })
    await writeFile(resolve(workspaceDir, '.ai.config.json'), '{}\n')
    await writeFile(resolve(realHome, '.gitconfig'), '[user]\\n\\tname = real\\n')
    await writeFile(
      resolve(targetDir, '.env'),
      [
        '__VF_PROJECT_WORKSPACE_FOLDER__=../..',
        '__VF_PROJECT_CONFIG_DIR__=.',
        '__VF_PROJECT_AI_BASE_DIR__=.iac/ai'
      ].join('\n')
    )
    const realWorkspaceDir = await realpath(workspaceDir)
    const realTargetDir = await realpath(targetDir)

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
  if (request === './loader' && parent?.filename === entryPath) {
    const fs = require('node:fs')
    const path = require('node:path')
    process.stdout.write(JSON.stringify({
      workspaceFolder: process.env.__VF_PROJECT_WORKSPACE_FOLDER__,
      configDir: process.env.__VF_PROJECT_CONFIG_DIR__,
      aiBaseDir: process.env.__VF_PROJECT_AI_BASE_DIR__,
      aiBaseDirSourceCwd: process.env.__VF_PROJECT_AI_BASE_DIR_RESOLVE_CWD__,
      home: process.env.HOME,
      gitConfigLink: fs.readlinkSync(path.join(process.env.HOME, '.gitconfig'))
    }))
    return {}
  }

  return originalLoad.call(this, request, parent, isMain)
}

require(entryPath).runCliPackageEntrypoint({
  packageDir: ${JSON.stringify(packageDir)}
})
      `
      ],
      {
        cwd: workspaceDir,
        env: {
          ...process.env,
          HOME: realHome,
          __VF_PROJECT_CONFIG_DIR__: 'business_modules/Miniapp'
        },
        encoding: 'utf8'
      }
    )

    expect(result.status).toBe(0)
    expect(result.signal).toBeNull()
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toEqual({
      workspaceFolder: realWorkspaceDir,
      configDir: realTargetDir,
      aiBaseDir: '.iac/ai',
      aiBaseDirSourceCwd: realTargetDir,
      home: resolve(realTargetDir, '.iac/ai/.mock'),
      gitConfigLink: resolve(realHome, '.gitconfig')
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
