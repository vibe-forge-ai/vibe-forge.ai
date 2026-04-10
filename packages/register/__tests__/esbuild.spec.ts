import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

describe('register/esbuild', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { force: true, recursive: true })))
  })

  it('falls back from relative .js requests to sibling .ts files inside node_modules', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-register-esbuild-'))
    tempDirs.push(tempDir)

    const packageDir = path.join(tempDir, 'node_modules', 'fixture-package')
    await mkdir(packageDir, { recursive: true })
    await writeFile(
      path.join(packageDir, 'package.json'),
      JSON.stringify({ name: 'fixture-package', version: '1.0.0' })
    )
    await writeFile(path.join(packageDir, 'dep.ts'), 'module.exports = { value: 42 }\n')
    await writeFile(path.join(packageDir, 'entry.ts'), "module.exports = require('./dep.js')\n")

    const result = spawnSync(
      process.execPath,
      [
        '--conditions=__vibe-forge__',
        '-r',
        require.resolve('../esbuild.js'),
        '-e',
        `console.log(require(${JSON.stringify(path.join(packageDir, 'entry.ts'))}).value)`
      ],
      {
        encoding: 'utf8'
      }
    )

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('42')
    expect(result.stderr).toBe('')
  })
})
