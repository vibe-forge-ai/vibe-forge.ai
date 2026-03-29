import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
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
      ['-e', `
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
      `],
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
})
